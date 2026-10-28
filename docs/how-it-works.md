# How XNote Placement works

## Why this is an extension and not a feature of XNote

XNote has been a native Wayland application since version 3.0. Under
Wayland a client **cannot place its own window**: `xdg_wm_base` has no
`set_position`, there is no monitor selection outside fullscreen, and no
workspace assignment protocol at all. That is why XNote had to drop pad
positioning along with the old X11 window hints. Note *size* still works,
because size is client-side.

Placement has to come from the compositor. This extension is the compositor
side. It stays a separate component so that XNote itself remains a plain
Wayland application with no compositor assumptions.

`xdg_session_management_v1` will eventually make this unnecessary. Mutter
50.1 already ships the implementation behind a debug flag and GTK 4.22 speaks
the client half, but nothing yet hands an application a session id that
survives a restart, and GNOME has said the feature will not be complete in
GNOME 51. When it lands, this extension retires.

## How a window is matched to a note

XNote is not a `GtkApplication`, so its pads are plain `GtkWindow`s with no
per-window D-Bus object path. Neither `xdg_toplevel_tag_v1` (GTK exposes the
`wl_surface` but never the `xdg_toplevel` the request needs) nor
`gtk_window_set_startup_id` (`MetaWindow.get_startup_id()` is `null` on
Wayland) reaches the compositor.

What does survive is the **title**, which XNote sets to the stripped first
line of the note as it is displayed. The note file keeps formatting inline —
each tag name between two U+E000 characters, with U+E001 escapes — so the
extension strips that markup the way XNote does, reproduces the title from
`~/.config/xnote/content-*` and matches on it, which resolves to the pad's
`info-*` id. Before 1.1.3 it compared the raw line, and a note with a bold
first line never matched.

Notes sharing a first line — typically several empty ones — are handed out
in `info-*` id order, visible notes before hidden ones: a hidden note has no
window, and before 1.1.3 it could take a visible note's record. XNote 3.2.3
and later opens its notes in that same id order, so the pairing is exact:
each window gets the id of the note it shows. Both sides compare ids byte by
byte (`strcmp` in XNote, `<` here). A locale-aware comparison would not do:
it sorts letters regardless of case (`info-a1` before `info-B1`, where
`strcmp` puts `info-B1` first), XNote's ids mix upper and lower case, and the
extension used one before 1.1.5.

Older XNote opens its notes in the order the filesystem lists their files,
so the pairing is stable at best: of two same-titled notes each may be
keeping a record first written by the other, which shows when one of them
later gets a different first line — the pair then trade places once. Where a
rewritten file is listed first, as on tmpfs, they trade places at every
restart, because XNote rewrites its files a few seconds after it starts.

One start stays inexact with any XNote: `xnote --show` when XNote is not
running opens the hidden notes in the same pass as the visible ones, while
their files still say hidden, so the extension offers them last. A hidden
note whose id sorts before a visible one with the same first line then
swaps records with it for that session.

If a note cannot be matched, it is left exactly where the compositor put it.
Nothing is guessed. During login and unlock bursts, `_pads()` reuses the
parsed pad list for 250 ms so adopting every open note does not re-read all
`info-*` and `content-*` files on the compositor thread for each window, and
falls back to an immediate re-read when a newly created or renamed window is
not in the cached list.

## Storage

`~/.local/state/xnote-placement/geometry.json`, keyed by pad id:

```json
{ "info-AB12CD": { "x": 1480, "y": 220, "width": 400, "height": 300,
                   "monitor": "ABC1234|DP-1", "workspace": 0 } }
```

The monitor key is **serial first**, connector second. Identical monitors
cannot be told apart by vendor or product, and a logical monitor *index*
reshuffles when a display wakes late or a KVM switches inputs. If the saved
monitor is not currently connected the note is left to the compositor rather
than placed off-screen, and a note is always clamped into the work area so a
resolution change cannot strand it. A saved workspace that does not exist
(fewer workspaces now, or dynamic workspaces at login) becomes the last one
that does.

The state directory is private to your account (`0700`) and the geometry
file is `0600`. The extension does not use the network. It reads only the
first line of each local XNote note, and from `info-*` which content file is
whose and whether the note is hidden, to match a window to its saved
geometry; note contents never leave the computer.

## Timing, which is the whole difficulty

Measured on mutter 50.1, per XNote window:

| when | frame rect | `wm_class` |
|---|---|---|
| `window-created` | `[0,0,0,0]` | `null` |
| `BEFORE_REDRAW` later | `[0,0,0,0]` | `xnote` |
| `IDLE` later | `[0,0,0,0]` | `xnote` |
| ~90 ms | `[1080,586,400,300]` | mutter places it on first real size |
| ~115 ms | `[1130,636,400,300]` | and again on the final size |

Filtering on `wm_class` at `window-created` would ignore every note, and a
position applied before the window has a size is thrown away. The extension
re-applies the stored position on every geometry change until the window
has settled, which converges without a magic delay — and re-applying
afterwards is the behaviour you want anyway: a note keeps its place when it
is resized.

Do not read the table as "the first real geometry arrives as
`size-changed`". Versions 1.0.0–1.0.2 assumed that, and it is not reliable:
mutter often emits no `size-changed` for the initial `0×0 → real-size`
transition, in which case the first real geometry arrives as
`position-changed`. Because the settle window was opened only from the
`size-changed` handler, it never opened, and that first `position-changed`
was recorded as if the user had dragged the note — mutter's centred default
overwrote the stored position, so every launch both misplaced the note and
destroyed its saved place. Since 1.0.3 the rule is signal-agnostic: **until a
window has settled, every geometry signal is the compositor's — re-assert
it, record nothing.**

The screen lock is the other half. GNOME Shell turns extensions off while
the screen is locked and back on at unlock, so every unlock re-adopts notes
that have been on screen for hours. Nothing is placing those, and a note that
already has a size is adopted as settled: its next move is yours. The
exception is a note whose saved monitor has not come back yet, which stays
settling so that the compositor's move when the monitor returns is corrected
rather than recorded. Notes sharing a first line are matched to the record of
the place each one occupies, not handed out in window-stacking order. Before
1.1.1 re-adopted notes were treated like new windows: a move straight after
unlocking snapped back, and two same-titled notes could swap places.

Login needs the same care. GNOME Shell 50 loads and enables extensions one at a
time, asynchronously, while gnome-session is already starting autostart
apps, so an autostarted XNote can open its notes before `enable()` runs —
observed on the maintainer's desktop, both within the same second. Such a
note is not on its record: mutter has placed it, part way or completely.
Only a note sitting exactly on its record (position and workspace) is
adopted as settled; any other note is put back and settles like a new
window, on its own settle timer since no further geometry signal may come.
While a note is being adopted and placed onto its saved workspace (before it
settles), any `demands_attention` flag set by the compositor's focus-stealing
prevention is cleared so background sticky notes restored across workspaces at
login never leave the dock icon bouncing as urgent.

Since 1.2.0 a newly opened note that has a saved record is also concealed
(actor hidden) at adoption, before mutter's first presentation, and revealed
only once it verifies as placed — saved workspace and clamped position — or
when it settles. Without this the centred default placement was visible for
a few milliseconds on login before the re-assert moved the note. Three
guarantees keep the conceal safe: a note already resting on its record when
the extension enables is never hidden, a 1.5 s fallback reveals a note whose
monitor is disconnected or whose placement never verifies, and disabling the
extension or unmanaging the window always reveals it first, so no code path
can strand an invisible note.
Before 1.1.3 a sized note counted as settled at `enable()`, so mutter's second
placement could be saved over the record, and a note it had finished placing
snapped back the first time it was moved.

## Testing

CI checks what it honestly can: the extension parses as an ES module,
`metadata.json` is self-consistent, the release invariants in
`tests/static-check.py` hold, the shell script is clean, and the Debian
package builds and passes lintian.

The behavioural test runs a nested headless GNOME Shell with its own config,
data, state and runtime directories and its own session bus against a scratch
fixture: seven notes (two same-titled and empty, two more sharing a first
line and told apart by size, one with a bold first line) beside a hidden
empty one. The second pair's ids sort one way byte by byte and the other way
by locale, and the fixture's directory lists them against id order; the test
asserts each of those windows got the id of the note XNote opened in it. It
moves the notes, relaunches XNote and asserts every visible one came back —
including the workspace, and each of that pair to its own place rather than
the other's — and that the hidden one took no record; then it simulates
screen locks and asserts that nothing moves at unlock, that a move straight
after it sticks, that `enable()` part way
through or after mutter's placement puts a note back without saving the
compositor's move, and that a failed write cannot leave the extension half
turned off. Each regression check fails on the release before its fix. It depends on a private test harness, so it runs
on the maintainer's desktop before every release rather than in CI.
