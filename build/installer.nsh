; MrxDown NSIS Custom Installer Script
; - Registers .md/.markdown file association (double-click opens in editor)
; - Adds "Mit MrxDown zu PDF konvertieren" context menu entry
; - Adds $INSTDIR to user PATH so the bundled mrxdown.cmd is usable from CMD/PowerShell

!macro customInstall
  ; --- File association: double-click opens .md files in MrxDown editor ---
  WriteRegStr HKCU "Software\Classes\.md" "" "MrxDown.Document"
  WriteRegStr HKCU "Software\Classes\.markdown" "" "MrxDown.Document"
  WriteRegStr HKCU "Software\Classes\MrxDown.Document" "" "Markdown Document"
  WriteRegStr HKCU "Software\Classes\MrxDown.Document\DefaultIcon" "" "$INSTDIR\MrxDown.exe,0"
  WriteRegStr HKCU "Software\Classes\MrxDown.Document\shell\open\command" "" '"$INSTDIR\MrxDown.exe" "%1"'

  ; --- Context menu: right-click → "Mit MrxDown zu PDF konvertieren" ---
  WriteRegStr HKCU "Software\Classes\.md\shell\MrxDownPDF" "" "Mit MrxDown zu PDF konvertieren"
  WriteRegStr HKCU "Software\Classes\.md\shell\MrxDownPDF" "Icon" "$INSTDIR\MrxDown.exe,0"
  WriteRegStr HKCU "Software\Classes\.md\shell\MrxDownPDF\command" "" '"$INSTDIR\MrxDown.exe" "--pdf" "%1"'

  WriteRegStr HKCU "Software\Classes\.markdown\shell\MrxDownPDF" "" "Mit MrxDown zu PDF konvertieren"
  WriteRegStr HKCU "Software\Classes\.markdown\shell\MrxDownPDF" "Icon" "$INSTDIR\MrxDown.exe,0"
  WriteRegStr HKCU "Software\Classes\.markdown\shell\MrxDownPDF\command" "" '"$INSTDIR\MrxDown.exe" "--pdf" "%1"'

  ; Notify Explorer of file association change
  System::Call 'shell32.dll::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'

  ; --- PATH: add $INSTDIR so "mrxdown" command works in CMD/PowerShell ---
  ReadRegStr $0 HKCU "Environment" "PATH"
  ${If} $0 == ""
    WriteRegExpandStr HKCU "Environment" "PATH" "$INSTDIR"
  ${Else}
    WriteRegExpandStr HKCU "Environment" "PATH" "$0;$INSTDIR"
  ${EndIf}
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro customUnInstall
  ; Remove file association (only if it still points to this install)
  ReadRegStr $0 HKCU "Software\Classes\MrxDown.Document\shell\open\command" ""
  ${If} $0 == '"$INSTDIR\MrxDown.exe" "%1"'
    DeleteRegKey HKCU "Software\Classes\MrxDown.Document"
    DeleteRegValue HKCU "Software\Classes\.md" ""
    DeleteRegValue HKCU "Software\Classes\.markdown" ""
  ${EndIf}

  ; Remove context menu entries
  DeleteRegKey HKCU "Software\Classes\.md\shell\MrxDownPDF"
  DeleteRegKey HKCU "Software\Classes\.markdown\shell\MrxDownPDF"

  System::Call 'shell32.dll::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend
