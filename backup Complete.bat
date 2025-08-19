@echo off
setlocal EnableDelayedExpansion

:: ── get the directory this script lives in
set "SRC=%~dp0"
:: strip trailing backslash if any
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"

:: ── build a timestamp: YYYY-MM-DD_HH-MM-SS
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do (
  set "MM=%%a" & set "DD=%%b" & set "YYYY=%%c"
)
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (
  set "HH=%%a" & set "Min=%%b"
)
:: remove any leading space in hour
if "%HH:~0,1%"==" " set "HH=0%HH:~1%"
set "TS=%YYYY%-%MM%-%DD%_%HH%-%Min%"

:: ── destination folder
set "DEST=%SRC%\backup\%TS%"

echo Creating backup at "%DEST%"…
mkdir "%DEST%"

:: ── copy everything except the backup folder itself
robocopy "%SRC%" "%DEST%" /E /XD "%SRC%\backup"

echo.
echo ✅ Backup complete!
echo   Source: %SRC%
echo   Destination: %DEST%

pause
