; Scoped NSIS protocol registration; quote both executable and URL arguments.
!macro customInstall
  WriteRegStr SHCTX "Software\Classes\myapp" "" "URL:myapp"
  WriteRegStr SHCTX "Software\Classes\myapp" "URL Protocol" ""
  WriteRegStr SHCTX "Software\Classes\myapp\shell\Open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend
!macro customUnInstall
  DeleteRegKey SHCTX "Software\Classes\myapp"
!macroend
