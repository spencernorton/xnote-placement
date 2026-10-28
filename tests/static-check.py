#!/usr/bin/env python3
from __future__ import annotations

import ast
import io
import json
import re
import tokenize
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
UUID = "xnote-placement@spencercnorton.github.io"
EXTENSION = ROOT / "extension.js"
METADATA = ROOT / "metadata.json"
SCRIPTS = ["scripts/build-deb.sh", "debian/rules", ".github/workflows/ci.yml", ".github/workflows/release.yml",
           ".github/FUNDING.yml",
           *sorted(str(p.relative_to(ROOT)) for p in (ROOT / ".github/ISSUE_TEMPLATE").glob("*.yml"))]
DOCS = ["README.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "SUPPORT.md", "CODE_OF_CONDUCT.md",
        "docs/how-it-works.md", ".github/PULL_REQUEST_TEMPLATE.md"]


def has_comment(js: str) -> bool:
    stack, quote, i = [], None, 0
    while i < len(js):
        c = js[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if quote == "`" and js.startswith("${", i):
                stack.append("`")
                quote = None
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in "'\"`":
            quote = c
        elif js.startswith(("//", "/*"), i):
            return True
        elif c == "{":
            stack.append("{")
        elif c == "}" and stack and stack.pop() == "`":
            quote = "`"
        i += 1
    return False


def python_comments(source: str) -> list[str]:
    found = [t.string for t in tokenize.generate_tokens(io.StringIO(source).readline)
             if t.type == tokenize.COMMENT and not (t.start[0] == 1 and t.string.startswith("#!"))]
    nodes = (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
    return found + [d for n in ast.walk(ast.parse(source)) if isinstance(n, nodes) and (d := ast.get_docstring(n))]


def main() -> None:
    metadata = json.loads(METADATA.read_text(encoding="utf-8"))
    assert metadata["uuid"] == UUID
    assert metadata["name"] == "XNote Placement"
    assert metadata["shell-version"] == ["50"]
    assert "version" not in metadata
    assert metadata["version-name"] == "1.2.0"
    assert metadata["url"] == "https://github.com/spencernorton/xnote-placement"

    source = EXTENSION.read_text(encoding="utf-8")
    assert has_comment("x(); // y") and has_comment("/* y */") and not has_comment("import G from 'gi://Gio';")
    assert has_comment("`a${ /* y */ b}`") and not has_comment("`a${b} // text`") and not has_comment("`${'//'}`")
    assert source.isascii(), "extension.js is plain ASCII: an invisible character reads as obfuscation"
    assert not has_comment(source), \
        "extension.js carries no comments: the why goes in docs/how-it-works.md or AGENTS.md"
    assert "localeCompare" not in source, \
        "ids compare byte by byte, the order XNote opens notes in; a locale folds case"
    assert "this._laterIds.add(id)" in source
    assert "this._laters.remove(id)" in source
    assert "get_compositor_private" in source
    assert "_conceal" in source and "_reveal" in source and "_revealIfPlaced" in source
    assert "REVEAL_FALLBACK_MS" in source
    assert "actor.hide()" in source and "?.show()" in source
    assert "Gio.FileCreateFlags.PRIVATE" in source
    assert "Gio.FILE_ATTRIBUTE_UNIX_MODE, 0o700" in source
    assert "Gio.FILE_ATTRIBUTE_UNIX_MODE, 0o600" in source

    assert python_comments("#!/usr/bin/env python3\nx = 1\n") == []
    assert python_comments("x = 1  # y\n") and python_comments('def f():\n    """y"""\n')
    assert not python_comments(Path(__file__).read_text(encoding="utf-8")), \
        "tests/static-check.py carries no comments or docstrings"
    for name in SCRIPTS:
        lines = (ROOT / name).read_text(encoding="utf-8").splitlines()
        assert not [ln for n, ln in enumerate(lines) if re.search(r"(^|\s)#", ln) and not (n == 0 and ln.startswith("#!"))], \
            f"{name} carries no comments"
    for name in DOCS:
        assert "<!--" not in (ROOT / name).read_text(encoding="utf-8"), f"{name} carries no HTML comments"

    assert (ROOT / "LICENSE").is_file()
    assert (ROOT / "NOTICE").is_file()
    for name in ("CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "SUPPORT.md",
                 "debian/control", "debian/install", "scripts/build-deb.sh",
                 ".github/workflows/ci.yml", "docs/how-it-works.md", "CODE_OF_CONDUCT.md"):
        assert (ROOT / name).is_file(), f"{name} must ship in the public release"
    install = (ROOT / "debian/install").read_text(encoding="utf-8")
    assert f"usr/share/gnome-shell/extensions/{UUID}" in install
    assert f"## {metadata['version-name']} " in (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert readme.rstrip().endswith("</p>"), "the suite footer strip is the last thing in the README"
    print(f"public release checks passed: {UUID} {metadata['version-name']}")


if __name__ == "__main__":
    main()
