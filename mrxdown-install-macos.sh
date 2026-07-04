#!/usr/bin/env bash
#
# mrxdown-install-macos.sh — Ein-Befehl-Installation von MrxDown auf macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/pepperonas/mrxdown/main/mrxdown-install-macos.sh | bash
#
# Warum dieses Skript (Muster: inspector-rust):
#   MrxDown ist nicht mit einem Apple-Developer-Zertifikat signiert. Ein von
#   Hand geladenes ZIP bekommt das Quarantäne-Attribut, und Gatekeeper meldet
#   „App ist beschädigt" bzw. verlangt Rechtsklick→Öffnen. Dieses Skript lädt
#   das passende Release direkt, entfernt die Quarantäne (xattr -cr) und
#   installiert nach /Applications — null Dialoge, ein Befehl.
#
#   Es lädt IMMER das neueste offizielle GitHub-Release von pepperonas/mrxdown
#   und erkennt die CPU-Architektur (Apple Silicon / Intel) automatisch.
#   Eine laufende MrxDown-Instanz wird sanft beendet (nie gekillt) — bei
#   ungespeicherten Änderungen fragt die App selbst nach.
#
set -euo pipefail

REPO="pepperonas/mrxdown"
APP="/Applications/MrxDown.app"

# ── Architektur ──────────────────────────────────────────────────────────────
case "$(uname -m)" in
  arm64) ASSET="mrxdown-macos-arm64.zip" ;;
  x86_64) ASSET="mrxdown-macos-x64.zip" ;;
  *) echo "✗ Nicht unterstützte Architektur: $(uname -m)" >&2; exit 1 ;;
esac

# ── Download-URL des neuesten Releases ───────────────────────────────────────
echo "▸ Suche neuestes Release…"
URL=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep -o "\"browser_download_url\": *\"[^\"]*${ASSET}\"" \
  | head -1 | sed 's/.*"\(https[^"]*\)"/\1/')
if [ -z "${URL}" ]; then
  echo "✗ Konnte ${ASSET} im neuesten Release nicht finden." >&2
  exit 1
fi
echo "  ${URL}"

# ── Download + Entpacken ─────────────────────────────────────────────────────
TMP=$(mktemp -d)
trap 'rm -rf "${TMP}"' EXIT
echo "▸ Lade herunter…"
curl -fL --progress-bar "${URL}" -o "${TMP}/${ASSET}"
echo "▸ Entpacke…"
ditto -x -k "${TMP}/${ASSET}" "${TMP}/extract"
SRC=$(find "${TMP}/extract" -maxdepth 2 -name "MrxDown.app" -type d | head -1)
[ -n "${SRC}" ] || { echo "✗ MrxDown.app nicht im Archiv gefunden." >&2; exit 1; }

# ── Quarantäne entfernen (der eigentliche Gatekeeper-Bypass) ─────────────────
echo "▸ Entferne Quarantäne-Attribut…"
xattr -cr "${SRC}" 2>/dev/null || true

# ── Laufende Instanz sanft beenden ───────────────────────────────────────────
if pgrep -f "MrxDown.app/Contents/MacOS/MrxDown" >/dev/null 2>&1; then
  echo "▸ MrxDown läuft — beende sanft (bei ungespeicherten Änderungen fragt die App)…"
  osascript -e 'tell application "MrxDown" to quit' >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do
    pgrep -f "MrxDown.app/Contents/MacOS/MrxDown" >/dev/null 2>&1 || break
    sleep 0.5
  done
  if pgrep -f "MrxDown.app/Contents/MacOS/MrxDown" >/dev/null 2>&1; then
    echo "✗ MrxDown läuft noch (offener Dialog?). Bitte beenden und Skript erneut ausführen." >&2
    exit 1
  fi
fi

# ── Installieren + Starten ───────────────────────────────────────────────────
echo "▸ Installiere nach ${APP}…"
rm -rf "${APP}"
ditto "${SRC}" "${APP}"
open "${APP}"

VERSION=$(defaults read "${APP}/Contents/Info" CFBundleShortVersionString 2>/dev/null || echo "?")
echo "✓ MrxDown ${VERSION} installiert und gestartet."
