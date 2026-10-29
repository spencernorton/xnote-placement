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
    try {
        for (let i = 0; i < 50 && extension._tracked.size !== 1; i++)
            await wait(100);
        expect(extension._tracked.size === 1, 'The extension did not recognize and track a real XNote window');
        const [window] = extension._tracked.keys();
        await wait(1000);
        if (phase === 'reenabled') {
            const actual = window.get_frame_rect();
            expect(actual.x === saved.x && actual.y === saved.y, 'The recreated note was not restored to its persisted position');
        }
        window.move_frame(true, 90, 120);
        await wait(1300);
        const [, bytes] = GLib.file_get_contents(extension._storePath);
        saved = JSON.parse(new TextDecoder().decode(bytes))['info-runtime'];
        const actual = window.get_frame_rect();
        expect(saved?.x === actual.x && saved?.y === actual.y && saved?.workspace === window.get_workspace().index(), 'Real window geometry was not persisted');
        const file = Gio.File.new_for_path(extension._storePath);
        expect((file.query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null).get_attribute_uint32('unix::mode') & 0o777) === 0o600, 'Geometry storage is not private');
    } finally {
        process.force_exit();
        await wait(200);
    }
}

export async function disabled({expect}) {
    expect(instance._tracked === null && instance._laterIds === null, 'Disabling retained window handlers or compositor callbacks');
}
