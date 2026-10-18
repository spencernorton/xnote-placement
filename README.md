<p align="center">
  <img src="https://raw.githubusercontent.com/spencernorton/xnote/main/images/hicolor/scalable/apps/xnote.svg" alt="XNote Placement icon" width="96">
</p>

<h1 align="center">XNote Placement</h1>

<p align="center">
  <strong>Puts every XNote sticky note back where you left it.</strong><br>
  A GNOME Shell extension that restores each note's position, monitor and workspace on Wayland, where the app cannot do it itself.
</p>

<p align="center">
  <a href="https://norvitech.com"><img alt="NorviTech Suite" src="https://img.shields.io/badge/NorviTech-Suite-FD8024.svg"></a>
  <a href="https://github.com/spencernorton/xnote-placement/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/spencernorton/xnote-placement/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/spencernorton/xnote-placement/tags"><img alt="Latest release" src="https://img.shields.io/github/v/tag/spencercnorton/xnote-placement?label=release&sort=semver"></a>
  <a href="https://norvitech.com/#install"><img alt="APT repository" src="https://img.shields.io/badge/apt-Ubuntu%2026.04-e95420.svg?logo=ubuntu&logoColor=white"></a>
  <a href="LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-blue.svg"></a>
  <a href="https://buy.stripe.com/8x26oH2U44f65TRe574wM04"><img alt="Donate" src="https://img.shields.io/badge/donate-Stripe-635bff.svg?logo=stripe&logoColor=white"></a>
</p>

<p align="center">
  <img alt="Five XNote sticky notes of different colours and sizes spread across a desktop, each where its owner left it" src="https://raw.githubusercontent.com/spencernorton/xnote/main/screenshots/xnote-desktop.png" width="900">
</p>

XNote's own reviewed capture: an isolated profile with invented notes, nothing personal.

[XNote](https://github.com/spencernorton/xnote) keeps each sticky note as its
own window, and since version 3.0 it is a native Wayland application. Under
Wayland a client cannot place its own window — no position, no monitor, no
workspace — so XNote remembers a note's size but not where it was. This
extension is the compositor side of that job, for GNOME Shell 50 on Wayland.

## What it does

**Remembers where every note is.** As you move or resize a note, the
extension records its position, its monitor and its workspace. The record is
keyed by the note, not by the window, so it survives XNote restarts.

**Puts it back.** When a note opens — after a login, after XNote restarts,
after a hidden note is shown again — it goes back to the recorded spot.
Nothing to configure; there are no settings.

**Matches by title, guesses nothing.** XNote's pads are plain windows with no
identity the compositor can see, so the extension reproduces each note's
title — its first line as XNote displays it, formatting stripped — from its
local file and matches on that. Notes that share a first line are handed out
in id order, visible notes before hidden ones; XNote 3.2.3 and later opens
its notes in the same order, so each gets its own record. A note that is
already open keeps the record of the place it occupies, and one that cannot
be matched is left exactly where the compositor put it.

**Knows which monitor is which.** Monitors are keyed by serial number first,
because identical models cannot be told apart otherwise and a monitor's index
reshuffles when a display wakes late or a KVM switches inputs. A note whose
monitor is not connected stays where the compositor put it rather than going
off-screen, and every note is clamped into the work area.

**Waits for the compositor to finish.** A new XNote window is 0×0 for the
first ~90 ms and mutter places it twice before it settles. Until a window has
settled, every geometry signal is the compositor's: the extension re-asserts
the stored place and records nothing, which converges without a magic delay.

## Install

It needs a GNOME Shell 50 session on Wayland and XNote 3.0.2 or later (3.2.3
or later to tell apart notes that share a first line exactly).

### Ubuntu 26.04 — from the APT repository

The same repository that serves XNote; `sudo apt install xnote` already
pulls this package in as a recommendation.

```bash
curl -fsSL https://apt.norvitech.com/setup.sh | sudo sh
sudo apt install gnome-shell-extension-xnote-placement
```

Log out and back in (a newly installed extension is discovered at login),
then enable it:

```bash
gnome-extensions enable xnote-placement@spencercnorton.github.io
```

### From source

```bash
git clone https://github.com/spencernorton/xnote-placement.git
cd xnote-placement
install -d ~/.local/share/gnome-shell/extensions/xnote-placement@spencercnorton.github.io
install -m 0644 extension.js metadata.json \
  ~/.local/share/gnome-shell/extensions/xnote-placement@spencercnorton.github.io/
```

After installing from source, log out and back in, then `gnome-extensions
enable xnote-placement@spencercnorton.github.io`. The APT repository is the
only release channel: the extension is not listed on extensions.gnome.org,
and releases carry no extension zip. It does nothing on X11.

**Upgrading from 1.0.x:** the extension's UUID changed to
`xnote-placement@spencercnorton.github.io`. Disable the 1.0.x extension,
remove its `xnote-placement@…` directory under
`~/.local/share/gnome-shell/extensions/`, install this one, log out and back
in, enable it. Saved geometry is kept — the state directory did not change.

## Documentation

- [How it works](docs/how-it-works.md) — matching a window to a note, the
  storage format, the timing measurements, and why this is an extension
  rather than a feature of XNote
- [CHANGELOG.md](CHANGELOG.md) — one entry per release

## Where your data lives

| Path | Purpose |
|---|---|
| `~/.local/state/xnote-placement/geometry.json` | One record per note: position, size, monitor (serial and connector) and workspace. Directory `0700`, file `0600`. |
| `~/.config/xnote/info-*`, `content-*` | XNote's own note files. Read only: which content file belongs to which note, whether it is hidden, and the first line of each note, to match a window to its record. |

Nothing leaves the machine: the extension has no network functionality.

## Contributing and support

- Bugs and feature requests: [open an issue](https://github.com/spencernorton/xnote-placement/issues/new/choose). Questions: [Discussions](https://github.com/spencernorton/xnote-placement/discussions).
- Security reports: [private vulnerability reporting](https://github.com/spencernorton/xnote-placement/security/advisories/new) — see [SECURITY.md](SECURITY.md). There is no e-mail address; that is deliberate.
- Pull requests are welcome; read [CONTRIBUTING.md](CONTRIBUTING.md) first.
- If XNote Placement saves you time, you can [support its development](https://buy.stripe.com/8x26oH2U44f65TRe574wM04).

## Development

```bash
cp extension.js /tmp/extension.mjs && node --check /tmp/extension.mjs   # what CI runs: parses as an ES module
python3 tests/static-check.py                                          # the release invariants
scripts/build-deb.sh /tmp/dist                                         # the .deb the APT repository publishes
shellcheck scripts/build-deb.sh
```

The behavioural test — a nested headless GNOME Shell, five notes and a
hidden one, XNote relaunched, every visible note asserted back, then
simulated screen locks and a login-time start —
depends on a private harness and runs on the maintainer's desktop before
every release.

## Licence

[GPL-3.0-or-later](LICENSE) © Spencer Norton

---

<p align="center">
  <a href="https://norvitech.com"><img alt="Part of the NorviTech Suite — open-source apps for the Linux desktop and the self-hosted stack" src="https://norvitech.com/assets/banner.svg" width="640"></a>
</p>

<p align="center">
  <a href="https://github.com/spencernorton/helios">Helios</a> ·
  <a href="https://github.com/spencernorton/bitagent">BitAgent</a> ·
  <a href="https://github.com/spencernorton/xnote">XNote</a> ·
  <a href="https://github.com/spencernorton/xnote-placement">XNote Placement</a> ·
  <a href="https://github.com/spencernorton/snipsnap">SnipSnap</a> ·
  <a href="https://github.com/spencernorton/conductor">Conductor</a> ·
  <a href="https://github.com/spencernorton/norvi-os">NorviOS</a> ·
  <a href="https://github.com/spencernorton/indigo">Indigo</a> ·
  <a href="https://github.com/spencernorton/roadtrack">Road Track</a> ·
  <a href="https://norvitech.com">norvitech.com</a>
</p>
