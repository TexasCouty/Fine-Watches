@echo off
setlocal EnableDelayedExpansion

:: ── 1) Determine your project root (this script’s folder)
set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"

:: ── 2) Build a timestamp YYYY-MM-DD_hh-mm-ss
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (
  set "MM=%%a" & set "DD=%%b" & set "YYYY=%%c"
)
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (
  set "HH=%%a" & set "Min=%%b"
)
if "%HH:~0,1%"==" " set "HH=0%HH:~1%"
for /f "tokens=2 delims=. " %%s in ("%TIME%") do set "SS=%%s"
set "TS=%YYYY%-%MM%-%DD%_%HH%-%Min%-%SS%"

:: ── 3) Make the destination folder
set "DEST=%SRC%\backup\%TS%"
mkdir "%DEST%"

echo Backing up to "%DEST%"...

:: ── 4a) Front-end code, excluding src\assets
robocopy "%SRC%\src" "%DEST%\src" /E /XD "%SRC%\src\assets"

:: ── 4b) Serverless functions
robocopy "%SRC%\functions" "%DEST%\functions" /E

:: ── 4c) Project manifest & config
robocopy "%SRC%" "%DEST%" netlify.toml package.json package-lock.json .gitignore README.md backup.bat

echo.
echo ✅  Backup complete!
echo    Source:      %SRC%
echo    Destination: %DEST%

pause

