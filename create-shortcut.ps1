# Puts a "MUNE TASKS" shortcut on your desktop. It starts the app without a console window
# (launch-mune-tasks.vbs); closing the MUNE TASKS window stops it again.
# Run once:  powershell -ExecutionPolicy Bypass -File .\create-shortcut.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = [Environment]::GetFolderPath("Desktop")
$link = Join-Path $desktop "MUNE TASKS.lnk"

# Remove the shortcut from before the rename, if present.
$old = Join-Path $desktop "Taskforge.lnk"
if (Test-Path $old) { Remove-Item $old }

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($link)
$shortcut.TargetPath = Join-Path $env:WINDIR "System32\wscript.exe"
$shortcut.Arguments = '"' + (Join-Path $root "launch-mune-tasks.vbs") + '"'
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = (Join-Path $root "public\icons\mune-tasks.ico") + ",0"
$shortcut.Description = "MUNE TASKS - AI project todo lists"
$shortcut.Save()

Write-Host "Shortcut created: $link"
