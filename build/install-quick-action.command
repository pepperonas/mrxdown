#!/bin/bash
# MrxDown Quick Action Installer
# Installiert die "MrxDown PDF" Quick Action für Finder-Kontextmenü

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKFLOW_NAME="MrxDown PDF.workflow"
WORKFLOW_SRC="$SCRIPT_DIR/$WORKFLOW_NAME"
SERVICES_DIR="$HOME/Library/Services"
WORKFLOW_DST="$SERVICES_DIR/$WORKFLOW_NAME"
PBS_PLIST="$HOME/Library/Preferences/pbs.plist"

# Prüfen ob Workflow vorhanden
if [ ! -d "$WORKFLOW_SRC" ]; then
    echo "Fehler: '$WORKFLOW_NAME' nicht gefunden in $SCRIPT_DIR"
    echo "Bitte das Skript aus dem entpackten ZIP-Ordner ausführen."
    exit 1
fi

# Services-Verzeichnis erstellen falls nötig
mkdir -p "$SERVICES_DIR"

# Workflow kopieren
echo "Installiere $WORKFLOW_NAME..."
rm -rf "$WORKFLOW_DST"
cp -R "$WORKFLOW_SRC" "$WORKFLOW_DST"

# Quarantine-Attribut entfernen
xattr -cr "$WORKFLOW_DST" 2>/dev/null || true

# Service im Kontextmenü registrieren
echo "Registriere Quick Action im Kontextmenü..."
/usr/bin/python3 -c "
import plistlib, os

pbs_path = os.path.expanduser('~/Library/Preferences/pbs.plist')
try:
    with open(pbs_path, 'rb') as f:
        pbs = plistlib.load(f)
except (FileNotFoundError, plistlib.InvalidFileException):
    pbs = {}

key = '(null) - MrxDown PDF - runWorkflowAsService'
pbs.setdefault('NSServicesStatus', {})[key] = {
    'enabled_context_menu': True,
    'enabled_services_menu': True,
    'presentation_modes': {
        'ContextMenu': True,
        'FinderPreview': True,
        'ServicesMenu': True,
        'TouchBar': True,
    }
}

with open(pbs_path, 'wb') as f:
    plistlib.dump(pbs, f)
"

# Pasteboard-Server aktualisieren
/System/Library/CoreServices/pbs -flush 2>/dev/null || true

# Finder neustarten
killall Finder 2>/dev/null || true

echo ""
echo "MrxDown PDF Quick Action installiert!"
echo "Rechtsklick auf .md-Datei → Dienste → MrxDown PDF"
echo ""
echo "Voraussetzung: CLI-Tool 'mrxdown' muss unter /usr/local/bin/mrxdown installiert sein."
