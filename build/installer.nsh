; MrxDown NSIS Custom Installer Script
; Adds "Mit MrxDown zu PDF konvertieren" context menu for .md and .markdown files

!macro customInstall
  ; .md context menu
  WriteRegStr HKCU "Software\Classes\.md\shell\MrxDownPDF" "" "Mit MrxDown zu PDF konvertieren"
  WriteRegStr HKCU "Software\Classes\.md\shell\MrxDownPDF" "Icon" "$INSTDIR\MrxDown.exe,0"
  WriteRegStr HKCU "Software\Classes\.md\shell\MrxDownPDF\command" "" '"$INSTDIR\MrxDown.exe" "--pdf" "%1"'

  ; .markdown context menu
  WriteRegStr HKCU "Software\Classes\.markdown\shell\MrxDownPDF" "" "Mit MrxDown zu PDF konvertieren"
  WriteRegStr HKCU "Software\Classes\.markdown\shell\MrxDownPDF" "Icon" "$INSTDIR\MrxDown.exe,0"
  WriteRegStr HKCU "Software\Classes\.markdown\shell\MrxDownPDF\command" "" '"$INSTDIR\MrxDown.exe" "--pdf" "%1"'
!macroend

!macro customUnInstall
  ; Clean up .md context menu
  DeleteRegKey HKCU "Software\Classes\.md\shell\MrxDownPDF"

  ; Clean up .markdown context menu
  DeleteRegKey HKCU "Software\Classes\.markdown\shell\MrxDownPDF"
!macroend
