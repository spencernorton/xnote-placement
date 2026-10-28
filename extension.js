import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const WM_CLASS = 'xnote';
const SAVE_DEBOUNCE_MS = 750;
const SETTLE_MS = 500;
const REVEAL_FALLBACK_MS = 1500;
const PAD_CACHE_US = 250000;
const TAG = '\ue000';

function readText(path) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok ? new TextDecoder().decode(bytes) : null;
    } catch {
        return null;
    }
}

function titleOf(content) {
    return content.split('\n')[0]
        .split(TAG)
        .filter((_, i) => i % 2 === 0)
        .map(s => s.replace(/\ue001([\ue001\ue002])/g, (_, c) => c === '\ue001' ? c : TAG))
        .join('')
        .replace(/^[ \t\n\v\f\r]+|[ \t\n\v\f\r]+$/g, '');
}

export default class XNotePlacementExtension extends Extension {
    enable() {
        this._configDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'xnote']);
        this._storePath = GLib.build_filenamev([GLib.get_user_state_dir(), 'xnote-placement', 'geometry.json']);
        this._stateDir = Gio.File.new_for_path(this._storePath).get_parent();
        this._prepareStateStorage();
        this._store = this._loadStore();

        this._claimed = new Map();
        this._tracked = new Map();
        this._padCache = null;
        this._padCacheAt = 0;
        this._laters = global.compositor.get_laters();
        this._laterIds = new Set();

        this._createdId = global.display.connect('window-created',
            (_display, win) => this._onWindowCreated(win));

        for (const actor of global.get_window_actors())
            this._adopt(actor.meta_window, true);
    }

    disable() {
        if (this._createdId) {
            global.display.disconnect(this._createdId);
            this._createdId = null;
        }
        for (const id of this._laterIds ?? [])
            this._laters.remove(id);
        this._laterIds?.clear();
        this._laterIds = null;
        this._laters = null;
        for (const win of [...this._tracked.keys()])
            this._untrack(win, true);
        this._tracked = null;
        this._claimed = null;
        this._padCache = null;
        this._padCacheAt = 0;
        this._store = null;
        this._stateDir = null;
        this._storePath = null;
        this._configDir = null;
    }

    _prepareStateStorage() {
        try {
            this._stateDir.make_directory_with_parents(null);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                throw e;
        }

        this._stateDir.set_attribute_uint32(
            Gio.FILE_ATTRIBUTE_UNIX_MODE, 0o700,
            Gio.FileQueryInfoFlags.NONE, null);
        const store = Gio.File.new_for_path(this._storePath);
        if (store.query_exists(null)) {
            store.set_attribute_uint32(
                Gio.FILE_ATTRIBUTE_UNIX_MODE, 0o600,
                Gio.FileQueryInfoFlags.NONE, null);
        }
    }

    _loadStore() {
        const text = readText(this._storePath);
        if (!text)
            return {};
        try {
            const parsed = JSON.parse(text);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch (e) {
            logError(e, 'xnote-placement: geometry store is corrupt, starting empty');
            return {};
        }
    }

    _saveStore() {
        this._prepareStateStorage();
        const bytes = new TextEncoder().encode(`${JSON.stringify(this._store, null, 1)}\n`);
        const store = Gio.File.new_for_path(this._storePath);
        store.replace_contents(
            bytes, null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION | Gio.FileCreateFlags.PRIVATE,
            null);
        store.set_attribute_uint32(
            Gio.FILE_ATTRIBUTE_UNIX_MODE, 0o600,
            Gio.FileQueryInfoFlags.NONE, null);
    }

    _readPads() {
        const pads = [];
        let entries;
        try {
            entries = Gio.File.new_for_path(this._configDir).enumerate_children(
                'standard::name', Gio.FileQueryInfoFlags.NONE, null);
        } catch {
            return pads;
        }

        let info;
        while ((info = entries.next_file(null)) !== null) {
            const name = info.get_name();
            if (!name.startsWith('info-') || name.endsWith('~'))
                continue;

            const text = readText(GLib.build_filenamev([this._configDir, name]));
            if (!text)
                continue;

            const line = text.split('\n').find(l => l.startsWith('content '));
            if (!line)
                continue;
            const contentName = line.slice('content '.length).trim();
            if (!contentName.startsWith('content-') || contentName.includes('/'))
                continue;

            const content = readText(GLib.build_filenamev([this._configDir, contentName])) ?? '';
            pads.push({id: name, title: titleOf(content), hidden: /^hidden 1$/m.test(text)});
        }
        entries.close(null);
        pads.sort((a, b) => a.hidden - b.hidden || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        return pads;
    }

    _pads(force = false) {
        const now = GLib.get_monotonic_time();
        if (!force && this._padCache && now - this._padCacheAt < PAD_CACHE_US)
            return this._padCache;
        this._padCache = this._readPads();
        this._padCacheAt = now;
        return this._padCache;
    }

    _identify(win, existing) {
        const title = win.get_title() ?? '';
        let free = this._pads().filter(p => p.title === title && !this._claimed.has(p.id));
        if (!free.length)
            free = this._pads(true).filter(p => p.title === title && !this._claimed.has(p.id));
        if (existing) {
            const {x, y} = win.get_frame_rect();
            const workspace = win.get_workspace()?.index();
            const here = free.find(p => {
                const g = this._store[p.id];
                return g && g.x === x && g.y === y && g.workspace === workspace;
            });
            if (here)
                return here.id;
        }
        return free[0]?.id ?? null;
    }

    _monitorKeys() {
        const keys = [];
        for (const logical of global.backend.get_monitor_manager().get_logical_monitors()) {
            const m = logical.get_monitors()[0];
            keys[logical.get_number()] = m
                ? `${m.get_serial() || ''}|${m.get_connector() || ''}`
                : null;
        }
        return keys;
    }

    _monitorIndexFor(key) {
        const idx = this._monitorKeys().indexOf(key);
        return idx >= 0 ? idx : null;
    }

    _onWindowCreated(win) {
        let id = 0;
        id = this._laters.add(Meta.LaterType.IDLE, () => {
            this._laterIds?.delete(id);
            if (this._tracked)
                this._adopt(win);
            return GLib.SOURCE_REMOVE;
        });
        this._laterIds.add(id);
    }

    _adopt(win, existing = false) {
        if (!win || win.get_wm_class() !== WM_CLASS || this._tracked.has(win))
            return;
        if (win.get_window_type() !== Meta.WindowType.NORMAL)
            return;

        const padId = this._identify(win, existing);
        if (!padId)
            return;

        const rect = win.get_frame_rect();
        const g = this._store[padId];
        const onMonitor = !g || this._monitorIndexFor(g.monitor) !== null;
        const inPlace = !g || (g.x === rect.x && g.y === rect.y &&
            g.workspace === win.get_workspace()?.index());
        const settled = existing && rect.width > 0 && rect.height > 0 && onMonitor && inPlace;
        this._claimed.set(padId, win);
        this._tracked.set(win, {padId, handlerIds: [], saveTimeout: 0, settleTimeout: 0, settled, concealed: false, revealTimeout: 0});

        if (!settled && g)
            this._conceal(win);
        this._applyPlacement(win, padId);
        if (win.demands_attention)
            win.unset_demands_attention?.();

        this._tracked.get(win).handlerIds = [
            win.connect('position-changed', () => {
                const entry = this._tracked.get(win);
                if (!entry)
                    return;
                if (entry.settled) {
                    this._reveal(win);
                    this._queueSave(win);
                } else {
                    if (!entry.concealed)
                        this._conceal(win);
                    this._beginSettle(win, padId);
                    this._applyPlacement(win, padId);
                    this._revealIfPlaced(win, padId);
                }
            }),
            win.connect('size-changed', () => {
                this._beginSettle(win, padId);
                this._applyPlacement(win, padId);
                this._revealIfPlaced(win, padId);
                if (this._tracked.get(win)?.settled)
                    this._queueSave(win);
            }),
            win.connect('workspace-changed', () => {
                if (this._tracked.get(win)?.settled)
                    this._queueSave(win);
            }),
            win.connect('notify::demands-attention', () => {
                if (!this._tracked.get(win)?.settled && win.demands_attention)
                    win.unset_demands_attention?.();
            }),
            win.connect('unmanaged', () => this._untrack(win, true)),
        ];
        if (onMonitor)
            this._beginSettle(win, padId);
    }

    _beginSettle(win, padId) {
        const entry = this._tracked.get(win);
        if (!entry || entry.settleTimeout || entry.settled)
            return;
        const rect = win.get_frame_rect();
        if (rect.width <= 0 || rect.height <= 0)
            return;

        entry.settleTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SETTLE_MS, () => {
            const e = this._tracked.get(win);
            if (e) {
                e.settleTimeout = 0;
                e.settled = true;
                this._reveal(win);
                this._queueSave(win);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _conceal(win) {
        const entry = this._tracked.get(win);
        if (!entry || entry.concealed)
            return;
        const actor = win.get_compositor_private();
        if (!actor)
            return;
        actor.remove_all_transitions?.();
        actor.opacity = 0;
        actor.hide();
        entry.concealed = true;
        if (!entry.revealTimeout) {
            entry.revealTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, REVEAL_FALLBACK_MS, () => {
                const e = this._tracked.get(win);
                if (e) {
                    e.revealTimeout = 0;
                    this._reveal(win);
                }
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _reveal(win) {
        const entry = this._tracked.get(win);
        if (!entry)
            return;
        if (entry.revealTimeout) {
            GLib.source_remove(entry.revealTimeout);
            entry.revealTimeout = 0;
        }
        if (!entry.concealed)
            return;
        entry.concealed = false;
        const actor = win.get_compositor_private();
        if (actor) {
            actor.opacity = 255;
            actor.show();
        }
    }

    _isPlaced(win, padId) {
        const g = this._store[padId];
        if (!g)
            return true;
        if (Number.isInteger(g.workspace) && win.get_workspace()?.index() !== g.workspace) {
            const idx = Math.min(g.workspace, global.workspace_manager.get_n_workspaces() - 1);
            if (idx >= 0 && win.get_workspace()?.index() !== idx)
                return false;
        }
        const monitor = this._monitorIndexFor(g.monitor);
        if (monitor === null)
            return false;
        const rect = win.get_frame_rect();
        if (rect.width <= 0 || rect.height <= 0)
            return false;
        const area = win.get_work_area_for_monitor(monitor);
        const x = Math.max(area.x, Math.min(g.x, area.x + area.width - rect.width));
        const y = Math.max(area.y, Math.min(g.y, area.y + area.height - rect.height));
        return rect.x === x && rect.y === y;
    }

    _revealIfPlaced(win, padId) {
        const entry = this._tracked.get(win);
        if (!entry?.concealed)
            return;
        if (!this._tracked.get(win)?.settled && win.demands_attention)
            win.unset_demands_attention?.();
        if (this._isPlaced(win, padId))
            this._reveal(win);
    }

    _applyPlacement(win, padId) {
        if (!this._tracked.get(win)?.settled && win.demands_attention)
            win.unset_demands_attention?.();
        const g = this._store[padId];
        if (!g)
            return;

        if (Number.isInteger(g.workspace)) {
            const wm = global.workspace_manager;
            const idx = Math.min(g.workspace, wm.get_n_workspaces() - 1);
            if (idx >= 0 && win.get_workspace()?.index() !== idx)
                win.change_workspace_by_index(idx, false);
        }
        if (!this._tracked.get(win)?.settled && win.demands_attention)
            win.unset_demands_attention?.();

        const rect = win.get_frame_rect();
        if (rect.width <= 0 || rect.height <= 0)
            return;

        const monitor = this._monitorIndexFor(g.monitor);
        if (monitor === null)
            return;

        const area = win.get_work_area_for_monitor(monitor);
        const x = Math.max(area.x, Math.min(g.x, area.x + area.width - rect.width));
        const y = Math.max(area.y, Math.min(g.y, area.y + area.height - rect.height));
        if (rect.x !== x || rect.y !== y)
            win.move_frame(true, x, y);
        this._revealIfPlaced(win, padId);
    }

    _queueSave(win) {
        const entry = this._tracked.get(win);
        if (!entry)
            return;

        const workspace = win.get_workspace();
        if (!workspace)
            return;
        const monitor = this._monitorKeys()[win.get_monitor()];
        if (!monitor)
            return;
        const rect = win.get_frame_rect();
        if (rect.width <= 0 || rect.height <= 0)
            return;
        this._store[entry.padId] = {
            x: rect.x, y: rect.y,
            width: rect.width, height: rect.height,
            monitor,
            workspace: workspace.index(),
        };

        if (entry.saveTimeout)
            GLib.source_remove(entry.saveTimeout);
        entry.saveTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SAVE_DEBOUNCE_MS, () => {
            entry.saveTimeout = 0;
            this._saveStore();
            return GLib.SOURCE_REMOVE;
        });
    }

    _untrack(win, flush) {
        const entry = this._tracked.get(win);
        if (!entry)
            return;
        const hadPendingWrite = entry.saveTimeout !== 0;
        if (entry.concealed) {
            entry.concealed = false;
            try {
                const actor = win.get_compositor_private();
                if (actor) {
                    actor.opacity = 255;
                    actor.show();
                }
            } catch {
            }
        }
        if (entry.revealTimeout)
            GLib.source_remove(entry.revealTimeout);
        if (entry.saveTimeout)
            GLib.source_remove(entry.saveTimeout);
        if (entry.settleTimeout)
            GLib.source_remove(entry.settleTimeout);
        for (const id of entry.handlerIds)
            win.disconnect(id);
        this._claimed.delete(entry.padId);
        this._tracked.delete(win);

        if (flush && hadPendingWrite) {
            try {
                this._saveStore();
            } catch (e) {
                logError(e, 'xnote-placement: could not save geometry');
            }
        }
    }
}
