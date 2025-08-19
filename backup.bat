@echo off
setlocal EnableDelayedExpansion

REM ─────────────────────────────────────────────────────────────────────────────
REM Grey Market DB: Snapshot backup (code + config, excludes heavy assets)
REM Adds: scripts/, data/; keeps .env excluded by default
REM Usage:
REM   backup.bat                -> standard backup (no secrets)
REM   backup.bat includeenv     -> ALSO back up .env (use only on your secure PC)
REM ─────────────────────────────────────────────────────────────────────────────

REM 1) Determine project root (this script’s folder)
set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"

REM 2) Build a timestamp YYYY-MM-DD_hh-mm-ss
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (
  set "MM=%%a" & set "DD=%%b" & set "YYYY=%%c"
)
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (
  set "HH=%%a" & set "MIN=%%b"
)
if "%HH:~0,1%"==" " set "HH=0%HH:~1%"
for /f "tokens=2 delims=. " %%s in ("%TIME%") do set "SS=%%s"

set "STAMP=%YYYY%-%MM%-%DD%_%HH%-%MIN%-%SS%"
set "DEST=%SRC%\backup\%STAMP%"

REM 3) Create destination
if not exist "%SRC%\backup" mkdir "%SRC%\backup"
mkdir "%DEST%" 2>nul

echo.
echo 📦  Creating snapshot: %DEST%
echo.

REM 4a) Frontend (exclude heavy assets)
if exist "%SRC%\src" (
  robocopy "%SRC%\src" "%DEST%\src" /E /XD "%SRC%\src\assets"
)

REM 4b) Serverless functions
if exist "%SRC%\functions" (
  robocopy "%SRC%\functions" "%DEST%\functions" /E
)

REM 4c) Project manifest & config
robocopy "%SRC%" "%DEST%" netlify.toml package.json package-lock.json .gitignore README.md backup.bat

REM 4d) Scripts (importers/crawlers/loaders)
if exist "%SRC%\scripts" (
  robocopy "%SRC%\scripts" "%DEST%\scripts" /E
)

REM 4e) Data (CSV and references.json). If large, you can comment this out.
if exist "%SRC%\data" (
  robocopy "%SRC%\data" "%DEST%\data" /E
)

REM 4f) Optional: include .env if user passes "includeenv"
if /I "%~1"=="includeenv" (
  if exist "%SRC%\.env" copy "%SRC%\.env" "%DEST%\" >nul
)

echo.
echo ✅  Backup complete!
echo    Source:      %SRC%
echo    Destination: %DEST%
echo.
echo    Tip: Run 'backup.bat includeenv' on a secure machine if you also want .env
echo.

pause
