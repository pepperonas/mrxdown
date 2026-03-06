#!/bin/bash
# MrxDown CLI - Markdown to PDF converter
# Usage: mrxdown /path/to/file.md

if [ -z "$1" ]; then
    echo "Usage: mrxdown <markdown-file>"
    echo "Example: mrxdown /path/to/file.md"
    exit 1
fi

# Convert relative path to absolute
if [[ "$1" != /* ]]; then
    FILE="$(pwd)/$1"
else
    FILE="$1"
fi

# Run Electron with flags to suppress Chromium noise in headless mode
/Applications/MrxDown.app/Contents/MacOS/MrxDown \
    --no-sandbox \
    --disable-gpu \
    --disable-software-rasterizer \
    --disable-features=ServiceWorker \
    --no-first-run \
    "$FILE" 2>&1 | grep -v "\[.*ERROR:service_worker_storage\|Failed to delete the database"
