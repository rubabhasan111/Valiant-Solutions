@echo off
rem Node was installed via winget and isn't on the parent shell's PATH.
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0.."
call npm run dev
