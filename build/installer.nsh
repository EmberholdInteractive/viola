!macro customInstall
  CreateShortCut "$SMPROGRAMS\Viola deinstallieren.lnk" "$INSTDIR\Uninstall Viola.exe"
!macroend
!macro customUnInstall
  Delete "$SMPROGRAMS\Viola deinstallieren.lnk"
!macroend
