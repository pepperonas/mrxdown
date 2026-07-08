#!/bin/bash
# MrxDown CLI - Markdown-Konverter (K7)
# Usage: mrxdown [--to pdf|html|docx|slides|epub] <datei-oder-verzeichnis ...>
#        mrxdown file.md                  → file.pdf (Default)
#        mrxdown --to docx file.md        → file.docx
#        mrxdown --to html docs/          → alle .md im Verzeichnis

FORMAT="pdf"
ARGS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --to)
            FORMAT="$2"
            shift 2
            ;;
        --pdf)
            FORMAT="pdf"
            shift
            ;;
        -h|--help)
            echo "Usage: mrxdown [--to pdf|html|docx|slides|epub] <datei-oder-verzeichnis ...>"
            echo "Beispiele:"
            echo "  mrxdown notes.md              # → notes.pdf"
            echo "  mrxdown --to docx notes.md    # → notes.docx"
            echo "  mrxdown --to html docs/       # alle .md im Verzeichnis"
            exit 0
            ;;
        *)
            # Relative Pfade absolut machen (Electron läuft mit eigenem cwd)
            if [[ "$1" != /* ]]; then
                ARGS+=("$(pwd)/$1")
            else
                ARGS+=("$1")
            fi
            shift
            ;;
    esac
done

if [ ${#ARGS[@]} -eq 0 ]; then
    echo "Usage: mrxdown [--to pdf|html|docx|slides|epub] <datei-oder-verzeichnis ...>"
    exit 1
fi

# Run Electron with flags to suppress Chromium noise in headless mode.
# Sandbox stays ON — CLI mode renders arbitrary user markdown, so OS-level
# process isolation matters. Previous --no-sandbox was unnecessary and weakened security.
/Applications/MrxDown.app/Contents/MacOS/MrxDown \
    --disable-gpu \
    --disable-software-rasterizer \
    --disable-features=ServiceWorker \
    --no-first-run \
    --to "$FORMAT" \
    "${ARGS[@]}" 2>&1 | grep -v "\[.*ERROR:service_worker_storage\|Failed to delete the database"
