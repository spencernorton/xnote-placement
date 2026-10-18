# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub:
**[Report a vulnerability](https://github.com/spencernorton/xnote-placement/security/advisories/new)**.
Do not open a public issue, and do not include real credentials, note titles, monitor serials
or personal paths in the report — a description and a minimal reproduction
are enough.

There is no e-mail address for security reports; the advisory form is the
only channel, and it is the one that is monitored. You will get an
acknowledgement within a week. Fixes ship as a tagged release; the advisory
is published once the release is out, and credits you unless you ask
otherwise.

## Supported versions

Only the latest tagged release is supported. XNote Placement has no LTS line.

## Scope

In scope: this repository's code and the artefacts it ships.
Out of scope: XNote itself (report to
[its own advisory form](https://github.com/spencernorton/xnote/security/advisories/new)),
third-party services XNote Placement connects to, and deployments the maintainer
does not operate.

## What XNote Placement does with credentials and data

Understanding the trust model helps you judge what is and is not a finding:

- **No credentials.** The extension holds no tokens or keys and talks to no service; there is nothing to store.
- **Nothing leaves the machine.** It has no network functionality. It reads the first line of each local XNote note (`~/.config/xnote/content-*`), and from `~/.config/xnote/info-*` which content file belongs to which note and whether it is hidden, only to match an open window to its saved geometry — using any more of a note than that would be a bug.
- **It runs inside GNOME Shell,** with the Shell's privileges, like every extension; that is not a boundary this project adds. Anything that lets it move a window other than XNote's, or place a note off-screen, is a safety bug — please report it.
- **Local state** lives under `~/.local/state/xnote-placement/` (directory `0700`,
  `geometry.json` `0600`): pad ids, positions, sizes, monitor serial and connector,
  workspace index. No telemetry is sent anywhere.
