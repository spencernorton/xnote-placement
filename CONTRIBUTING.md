# Contributing to XNote Placement

Thanks for your interest. XNote Placement is a small project with one maintainer, so
the process is deliberately light — but a few things are fixed.

## How changes land

Development happens in this repository. Pull requests target `main`; once
CI passes, an accepted pull request is squash-merged, so it lands as one
commit credited to you. A release is a `vX.Y.Z` tag on `main`: the Release
workflow builds the `.deb` and publishes it with the tagged source, and
[CHANGELOG.md](CHANGELOG.md) says what changed.

- Keep a pull request to one change, and rebase it onto `main` only.

## Before you start

- **Bugs** — open a [bug report](https://github.com/spencernorton/xnote-placement/issues/new/choose).
  A report with reproduction steps, versions and a scrubbed log excerpt is
  usually fixed faster than a pull request that arrives without one.
- **Features** — open a feature request first. XNote Placement has strong opinions
  about doing one thing — putting XNote notes back where they were — and guessing nothing when a note cannot be matched
  (see the README); an idea that cuts across them needs a conversation before
  code.
- **Security** — never in a public issue. Use
  [private vulnerability reporting](https://github.com/spencernorton/xnote-placement/security/advisories/new);
  see [SECURITY.md](SECURITY.md).

## Working on the code

```bash
sudo apt install shellcheck build-essential debhelper dpkg-dev lintian   # Ubuntu; node is in the base image on CI
cp extension.js /tmp/extension.mjs && node --check /tmp/extension.mjs   # parses as an ES module — what CI runs
python3 tests/static-check.py                                          # the release invariants
shellcheck scripts/build-deb.sh                                        # lint; CI enforces it
scripts/build-deb.sh /tmp/dist                                         # the .deb the APT repository publishes
```

The behavioural test is a nested headless GNOME Shell against a scratch
fixture: five notes moved beside a hidden one, XNote relaunched, every
visible one asserted back — workspace included — and simulated screen locks
and a login-time start. It depends on a private harness, so it runs on the
maintainer's desktop before a release, not in CI; say in the pull request how
you exercised a change on your own desktop.

- Until a window has settled, every geometry signal is the compositor's: re-assert the stored geometry, record nothing. The README's timing table is why; weakening that rule brings back the 1.0.0–1.0.2 bug where mutter's centred default overwrote the saved position on every launch.
- A note that is already open and sized when the extension is enabled — after every screen unlock — is settled from the start (unless its saved monitor is missing), and among same-titled notes it keeps the record of the place it occupies. Adopting it like a new window undid the first move after unlocking and could swap same-titled notes (fixed in 1.1.1).
- `extension.js` and `metadata.json` stay at the repository root; `version-name` is the version, the numeric `version` belongs to extensions.gnome.org.
- `extension.js` carries no comments, and `tests/static-check.py` fails on one. Explain a change in the pull request, and a design fact in `docs/how-it-works.md`.
- Keep a change to one concern. A pull request that fixes a bug and
  reformats a file is two pull requests.
- Tests: a bug fix carries a regression test; a feature carries the smallest
  test that fails without it.
- Commits carry a `Signed-off-by:` line (`git commit -s`, the Developer
  Certificate of Origin). There is no CLA.
- No secrets, hostnames, personal data or screenshots of a real desktop in
  the diff; a pull request that carries them is sent back.

## Out of scope

So nobody wastes an evening on it, XNote Placement will not accept:

- telemetry, analytics, or any network functionality
- placing windows of any application other than XNote — this is not a general window-placement extension
- reading more of a note than its first line, or writing anywhere but `~/.local/state/xnote-placement/`
- changes to XNote itself — that is the [XNote repository](https://github.com/spencernorton/xnote)

## Pull request checklist

The template asks for what changed, why, and how it was tested, plus a
confirmation that the diff carries no secrets, machine names or personal
paths. Fill it in — it is what the reviewer reads first.

## Licence

By contributing you agree that your contribution is licensed under the
[GNU General Public License, version 3 or later](LICENSE) that covers the project.

The private Shell acceptance waits for the fixture client to map and settle,
for its geometry to reach disk, and for complete process/window teardown.
These are bounded observations, not fixed sleeps around compositor work.
