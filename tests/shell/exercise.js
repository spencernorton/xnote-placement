import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

let instance;
let saved;
const client = `imports.gi.versions.Gtk='4.0';
const {Gtk,GLib}=imports.gi;
GLib.set_prgname('xnote'); Gtk.init();
const window=new Gtk.Window({title:'Runtime Note'});
window.set_default_size(240,160); window.present();
new GLib.MainLoop(null,false).run();`;

export async function exercise(extension, {wait, expect, phase}) {
    instance = extension;
    const config = GLib.build_filenamev([GLib.get_user_config_dir(), 'xnote']);
    GLib.mkdir_with_parents(config, 0o700);
    GLib.file_set_contents(`${config}/info-runtime`, 'content content-runtime\nhidden 0\n');
    GLib.file_set_contents(`${config}/content-runtime`, 'Runtime Note');
    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
    launcher.setenv('WAYLAND_DISPLAY', GLib.getenv('WAYLAND_DISPLAY') || 'wayland-0', true);
    const process = launcher.spawnv(['gjs', '-c', client]);
    const until = async (check, description) => {
        for (let i = 0; i < 100; i++) {
            const value = check();
            if (value)
                return value;
            await wait(100);
        }
        throw new Error(`Timed out waiting for ${description}`);
    };
    const geometry = () => {
        if (!GLib.file_test(extension._storePath, GLib.FileTest.EXISTS))
            return null;
        const [, bytes] = GLib.file_get_contents(extension._storePath);
        return JSON.parse(new TextDecoder().decode(bytes))['info-runtime'];
    };
    try {
        await until(() => extension._tracked.size === 1, 'a tracked real note');
        const [window] = extension._tracked.keys();
        await until(() => window.get_compositor_private()?.mapped &&
            extension._tracked.get(window)?.settled, 'the mapped note to finish initial placement');
        if (phase === 'reenabled') {
            await until(() => {
                const actual = window.get_frame_rect();
                return actual.x === saved.x && actual.y === saved.y;
            }, 'the recreated note to restore its persisted position');
        }
        const target = phase === 'reenabled' ? {x: 180, y: 200} : {x: 90, y: 120};
        window.move_frame(true, target.x, target.y);
        await until(() => {
            const actual = window.get_frame_rect();
            const stored = geometry();
            return actual.x === target.x && actual.y === target.y &&
                stored?.x === actual.x && stored?.y === actual.y &&
                stored?.workspace === window.get_workspace().index();
        }, 'the actual moved note geometry to reach disk');
        saved = geometry();
        const file = Gio.File.new_for_path(extension._storePath);
        expect((file.query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null).get_attribute_uint32('unix::mode') & 0o777) === 0o600, 'Geometry storage is not private');
        console.log(`RUNTIME-ACCEPTANCE placement: ${phase} saved ${JSON.stringify(saved)}`);
    } finally {
        process.force_exit();
        await new Promise(resolve => process.wait_async(null, (source, result) => {
            source.wait_finish(result);
            resolve();
        }));
        await until(() => extension._tracked.size === 0, 'the actual client to unmap and release tracking');
    }
}

export async function disabled({expect}) {
    expect(instance._tracked === null && instance._laterIds === null, 'Disabling retained window handlers or compositor callbacks');
}
