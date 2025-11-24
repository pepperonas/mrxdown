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

# Run from within the app bundle context
cd /Applications/MrxDown.app/Contents/MacOS
./MrxDown "$FILE"
