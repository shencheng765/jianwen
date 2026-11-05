Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
Var NoIntegration
!ifndef VERSION
  !error "Pass /DVERSION=<version> to makensis"
!endif
Name "简文"
OutFile "..\release\Jianwen-${VERSION}-Setup-x64.exe"
InstallDir "$LOCALAPPDATA\Programs\Jianwen"
InstallDirRegKey HKCU "Software\Jianwen" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "..\assets\icon.ico"
UninstallIcon "..\assets\icon.ico"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=2052 "ProductName" "简文安装程序"
VIAddVersionKey /LANG=2052 "FileDescription" "简文 ${VERSION} 安装程序"
VIAddVersionKey /LANG=2052 "FileVersion" "${VERSION}.0"
VIAddVersionKey /LANG=2052 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=2052 "LegalCopyright" "Copyright 2026"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Jianwen.exe"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_TEXT "简文已安装。原有草稿和设置会保留。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Function .onInit
  ; An isolated verification install must not replace the user's shortcuts.
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/NOINTEGRATION" $R1
  IfErrors +2
    StrCpy $NoIntegration "1"
FunctionEnd

Section "简文" Main
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /oname=Jianwen.exe "..\release\Jianwen-${VERSION}-Windows-x64.exe"
  File /oname=Jianwen-${VERSION}.ico "..\assets\icon.ico"
  File "..\THIRD-PARTY-NOTICES.md"
  ; Prepare only immutable files; do not launch the app or a resident browser.
  ExecWait '"$INSTDIR\Jianwen.exe" --prepare-runtime' $R2
  ; Only import the four application records on a first install. Never copy
  ; browser caches or overwrite an already installed profile during upgrades.
  IfFileExists "$INSTDIR\JianwenData\session-lite.json" profile_done
  IfFileExists "$INSTDIR\JianwenData\session.json" profile_done
  IfFileExists "$INSTDIR\JianwenData\settings-lite.json" profile_done
  IfFileExists "$EXEDIR\JianwenData\session-lite.json" 0 profile_done
  CreateDirectory "$INSTDIR\JianwenData"
  CopyFiles /SILENT /FILESONLY "$EXEDIR\JianwenData\session-lite.json" "$INSTDIR\JianwenData"
  CopyFiles /SILENT /FILESONLY "$EXEDIR\JianwenData\session.json" "$INSTDIR\JianwenData"
  CopyFiles /SILENT /FILESONLY "$EXEDIR\JianwenData\settings-lite.json" "$INSTDIR\JianwenData"
  CopyFiles /SILENT /FILESONLY "$EXEDIR\JianwenData\settings.json" "$INSTDIR\JianwenData"
  CopyFiles /SILENT /FILESONLY "$EXEDIR\JianwenData\workspace.json" "$INSTDIR\JianwenData"
  CopyFiles /SILENT /FILESONLY "$EXEDIR\JianwenData\recent.json" "$INSTDIR\JianwenData"
  CopyFiles /SILENT /FILESONLY "$EXEDIR\JianwenData\print.json" "$INSTDIR\JianwenData"
  CopyFiles /SILENT /FILESONLY "$EXEDIR\JianwenData\spelling-words.json" "$INSTDIR\JianwenData"
  IfFileExists "$EXEDIR\JianwenData\Windows\*.*" 0 +2
  CopyFiles /SILENT "$EXEDIR\JianwenData\Windows" "$INSTDIR\JianwenData"
  ; Large-file session records refer to disk-backed draft segments.
  IfFileExists "$EXEDIR\JianwenData\LargeDrafts\*.*" 0 +2
  CopyFiles /SILENT "$EXEDIR\JianwenData\LargeDrafts" "$INSTDIR\JianwenData"
profile_done:
  ClearErrors
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  ${If} $NoIntegration == "1"
    FileOpen $R0 "$INSTDIR\.no-integration" w
    FileClose $R0
    Goto integration_done
  ${EndIf}
  CreateShortCut "$DESKTOP\简文.lnk" "$INSTDIR\Jianwen.exe" "" "$INSTDIR\Jianwen.exe"
  CreateShortCut "$SMPROGRAMS\简文.lnk" "$INSTDIR\Jianwen.exe" "" "$INSTDIR\Jianwen.exe"
  WriteRegStr HKCU "Software\Jianwen" "InstallDir" "$INSTDIR"
  ; A versioned icon path avoids Explorer retaining the previous EXE icon.
  WriteRegStr HKCU "Software\Classes\Applications\Jianwen.exe\DefaultIcon" "" "$INSTDIR\Jianwen-${VERSION}.ico,0"
  WriteRegStr HKCU "Software\Classes\Applications\Jianwen.exe\shell\open\command" "" '$\"$INSTDIR\Jianwen.exe$\" $\"%1$\"'
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Jianwen" "DisplayName" "简文"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Jianwen" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Jianwen" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Jianwen" "DisplayIcon" "$INSTDIR\Jianwen.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Jianwen" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Jianwen" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Jianwen" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Jianwen" "NoRepair" 1
integration_done:
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$INSTDIR\Jianwen.exe"
  Delete "$INSTDIR\Jianwen-${VERSION}.ico"
  Delete "$INSTDIR\THIRD-PARTY-NOTICES.md"
  Delete "$INSTDIR\Uninstall.exe"
  IfFileExists "$INSTDIR\.no-integration" skip_integration
  Delete "$DESKTOP\简文.lnk"
  Delete "$SMPROGRAMS\简文.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Jianwen"
  DeleteRegKey HKCU "Software\Jianwen"
  ReadRegStr $R0 HKCU "Software\Classes\Applications\Jianwen.exe\DefaultIcon" ""
  StrCmp $R0 "$INSTDIR\Jianwen-${VERSION}.ico,0" 0 +2
    DeleteRegKey HKCU "Software\Classes\Applications\Jianwen.exe\DefaultIcon"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
skip_integration:
  Delete "$INSTDIR\.no-integration"
  ; Nonrecursive: user drafts and settings deliberately survive uninstallation.
  RMDir "$INSTDIR"
SectionEnd
