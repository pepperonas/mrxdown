@echo off
:: mrxdown - Markdown-Konverter (PDF/HTML/DOCX) von der Kommandozeile
:: Usage: mrxdown file.md                  (→ file.pdf)
::        mrxdown --to docx file.md        (→ file.docx)
::        mrxdown --to html verzeichnis\   (alle .md im Verzeichnis)
:: Ohne --to wird PDF erzeugt (--pdf bleibt als Alias erhalten).
if "%~1"=="--to" (
    "%~dp0MrxDown.exe" %*
) else (
    "%~dp0MrxDown.exe" --pdf %*
)
