# Changelog

All notable changes to XNote Placement are documented here.

## 1.2.2 — 2026-10-29

- Fix notes flashing at the compositor's centred placement again on busy
  logins. A new XNote window is now hidden synchronously in the
  `window-created` handler instead of at the following idle, which a loaded
  Shell could delay past the first presented frames. Windows that turn out
  not to be notes are restored at that same idle, and disabling the
  extension restores any window still waiting for it.

## 1.2.1 — 2026-10-29

- Fix glitchy blur left on the active workspace by notes restored to another
  workspace. Revealing a note after placement now respects the compositor's
  workspace visibility instead of showing its actor unconditionally, so a
  note placed on an inactive workspace stays hidden there until that
  workspace is shown. The same guard applies when the extension is disabled
  or a note closes while concealed. Blur My Shell's application blur had
  followed the forced-visible actor and painted a blurred rectangle with no
  note on top of it; moving the note to another workspace therefore left
  the blur behind on the current workspace.

## 1.2.0 — 2026-10-28

- Hide each newly opened note until it has been moved to its saved position,
  monitor and workspace, so notes no longer flash at the compositor default
  in the centre of the screen on login before snapping to their workspace.
  A note is revealed as soon as it verifies as placed, when it settles, or
  after a 1.5 s fallback, so a disconnected monitor or an unmatched note can
  never leave it invisible. Disabling the extension or closing a note always
  reveals it first. Notes already resting on their record at enable are
  never hidden.

## 1.1.8 — 2026-10-27

- Clear any compositor `demands_attention` state when adopting and placing
  newly opened notes across workspaces so restored notes do not mark the dock
  icon urgent or force workspace-by-workspace activation on login.
- Arm the settle timer whenever a newly created note already has a non-zero
  frame rectangle at adoption time, even if its initial geometry signals fired
  before `IDLE` adoption connected its listeners.

## 1.1.7 — 2026-10-26

- Cache the parsed `~/.config/xnote` pad list for 250 ms during window adoption
  bursts so login and screen unlock do not re-read every `info-*` and
  `content-*` file on the compositor thread for each window, falling back to an
  immediate re-read when a newly opened or renamed note is not in the cached
  list.
- Update remaining GitHub repository links to `spencernorton` while keeping the
  extension UUID `xnote-placement@spencercnorton.github.io`.

## 1.1.6 — 2026-10-07

- No change to the extension. Development moved to this repository: pull
  requests are merged here, and a `v*` tag publishes the `.deb` with the
  tagged source as a GitHub Release.
- Fix: `scripts/build-deb.sh` could fail at random while checking the built
  package. It now reads the package listing once and checks that.
- The README names the whole suite in its footer, and installs from
  apt.norvitech.com.
- Releases no longer carry `xnote-placement.shell-extension.zip`. The APT
  repository is the only release channel.
- Packaging: the maintainer is NorviTech, and the package recommends
  `norvi-archive-keyring`, which keeps the APT source and key up to date.

## 1.1.5 — 2026-09-29

- Fix: notes that share a first line (several empty ones, typically) could
  each be keeping a place first saved by another of them. With XNote 3.2.3
  or later they are paired exactly: XNote opens its notes in id order, and
  the extension now orders ids the same way, byte by byte, rather than by
  the desktop's locale, which sorts letters regardless of case while XNote's
  ids mix both. After upgrading both, such notes may trade places once.

## 1.1.4 — 2026-09-29

- No change to the extension. The build, test and CI scripts and the
  repository templates carry no comments.

## 1.1.3 — 2026-09-29

- Fix: a note whose first line has formatting (bold, italic, underline or
  strikethrough) was never matched, so it opened wherever the compositor put
  it. XNote keeps formatting inline in the note file; the extension now reads
  the title the way XNote displays it.
- Fix: a hidden note could take the saved place of a visible note sharing its
  first line — typically an empty one — so that note opened at the hidden
  note's spot. Visible notes are matched first.
- Fix: at login GNOME Shell can switch the extension on while XNote is still
  opening its notes. A note the compositor was still placing could have that
  placement saved over its record, and one it had finished placing was put
  back but snapped back again the first time it was moved. When the extension
  starts, only a note sitting exactly on its record counts as settled.

## 1.1.2 — 2026-09-29

- `extension.js` carries no comments. What they explained is in
  [docs/how-it-works.md](docs/how-it-works.md). The code itself is
  unchanged: its token stream is identical to 1.1.1's.

## 1.1.1 — 2026-09-29

- Fix: a note moved straight after unlocking the screen snapped back to its
  old place, and a move to another workspace was not saved. The Shell turns
  extensions off while the screen is locked; on unlock, notes that were
  already open were treated as if the compositor were still placing them.
- Fix: two notes sharing a first line (typically empty ones) could swap
  places at unlock. A note that is already open now keeps the record of the
  place it occupies.
- A failed geometry write while the screen locks no longer leaves the
  extension half turned off until the next login.
- The extension description names its XNote requirement.
- The shipped extension no longer reads a test-only environment variable; the
  behavioural test gives its nested Shell private config and state
  directories instead.
- The Debian package description gives the enable step in the right order,
  and the storage example in the documentation uses placeholder values.

## 1.1.0 — 2026-09-21

- First public release, on GitHub and in the APT repository as
  `gnome-shell-extension-xnote-placement` (installs system-wide; XNote's
  package recommends it).
- The extension UUID is now `xnote-placement@spencercnorton.github.io`.
  Upgrading from 1.0.x: disable and remove the old directory, install this
  one, log out and back in, enable. Saved geometry is kept.
- Community files, issue forms, a GitHub CI workflow (ESM parse, release
  invariants, shellcheck, package build) and a README that explains the
  matching, the storage and the timing.

## 1.0.4 — 2026-09-19 (unreleased)

- Cancel pending GNOME Shell `Meta.Laters` callbacks when the extension is
  disabled.
- Store geometry in a private `0700` directory and `0600` file, including
  migration of existing state.
- Add the public licence, provenance, privacy, install and release metadata.

## 1.0.3 — 2026-08-19

- Restore notes even when Mutter reports their first real geometry through
  `position-changed` without an earlier `size-changed` signal.
- Keep compositor placement from overwriting the saved position at startup.

## 1.0.2 — 2026-08-03

- Preserve workspaces when XNote windows are torn down.
- Save workspace-only moves and re-assert placement through Mutter's startup
  settle window.

## 1.0.1 — 2026-08-03

- Align extension metadata with the first CI-corrected release.

## 1.0.0 — 2026-08-03

- Initial release for GNOME Shell 50 and XNote on Wayland.
