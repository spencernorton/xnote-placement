#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
out=$(realpath -m "${1:-$root/dist}")
pkg=gnome-shell-extension-xnote-placement
version=$(sed -n 's/^ *"version-name": *"\([^"]*\)".*/\1/p' "$root/metadata.json")
test -n "$version"
stamp=${SOURCE_DATE_EPOCH:-$(date +%s)}
export SOURCE_DATE_EPOCH="$stamp"
mkdir -p "$out"

changelog="$root/debian/changelog"
saved=$(mktemp)
if [ -f "$changelog" ]; then
    cp "$changelog" "$saved"
    trap 'cp "$saved" "$changelog"; rm -f "$saved"' EXIT
else
    trap 'rm -f "$saved" "$changelog"' EXIT
fi
cat > "$changelog" <<CHANGELOG
$pkg ($version) resolute; urgency=medium

  * Release $version. The release notes:
    https://github.com/spencernorton/xnote-placement/blob/main/CHANGELOG.md

 -- NorviTech <apt@globalentry.systems>  $(date -u -d "@$stamp" '+%a, %d %b %Y %H:%M:%S +0000')
CHANGELOG
(cd "$root" && dpkg-buildpackage -us -uc -b)
deb="$out/${pkg}_${version}_all.deb"
mv "$root/../${pkg}_${version}_all.deb" "$deb"
rm -f "$root"/../"${pkg}"_"${version}"_*.buildinfo "$root"/../"${pkg}"_"${version}"_*.changes

uuid=$(sed -n 's/^ *"uuid": *"\([^"]*\)".*/\1/p' "$root/metadata.json")
test -n "$uuid"
contents=$(dpkg-deb -c "$deb")
grep -q "usr/share/gnome-shell/extensions/$uuid/extension.js" <<<"$contents" || {
    echo "ERROR - extension.js is not installed under the uuid directory $uuid" >&2; exit 1; }
grep -q "usr/share/gnome-shell/extensions/$uuid/metadata.json" <<<"$contents" || {
    echo "ERROR - metadata.json is not installed under the uuid directory $uuid" >&2; exit 1; }
ls -l "$out"
