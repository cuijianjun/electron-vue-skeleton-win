; NSIS 自定义安装脚本：注册 myapp:// 自定义协议（URL Protocol）
; 网页中通过 myapp://xxx 即可唤起应用
; 安装时写入注册表，卸载时删除

!macro customInstall
  DeleteRegKey HKCR "myapp"
  WriteRegStr HKCR "myapp" "" "URL:myapp"
  WriteRegStr HKCR "myapp" "URL Protocol" ""
  WriteRegStr HKCR "myapp\shell" "" ""
  WriteRegStr HKCR "myapp\shell\Open" "" ""
  WriteRegStr HKCR "myapp\shell\Open\command" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME} %1"
  WriteRegStr HKCR "myapp\shell\Open\command" "installLocation" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!macroend

!macro customUnInstall
  DeleteRegKey HKCR "myapp"
!macroend
