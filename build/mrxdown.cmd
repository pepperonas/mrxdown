@echo off
:: mrxdown - convert Markdown to PDF from the command line
:: Usage: mrxdown file.md           (convert single file)
::        mrxdown directory\         (batch-convert all .md files in directory)
"%~dp0MrxDown.exe" --pdf %*
