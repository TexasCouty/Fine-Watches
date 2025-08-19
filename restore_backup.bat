@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ──────────────────────────────────────────────────────────────────────────
REM LuxeTime — Restore from backup (SAFE v2)
REM Assumes backups live in ".\backups\<timestamp>\"
REM Writes a log to "restore.log" and ALWAYS pauses before closing.
REM Usage:
REM   Double-click (interactive)
REM   restore_backup.bat latest
REM   restore_backup.bat 2025-08-19_1625   (exact folder under .\backups)
REM ──────────────────────────────────────────────────────────────────────────

set "PROJECT_ROOT=%~dp0"
set "BACKUPS_DIR=%PROJECT_ROOT%backups"
set "SNAP_DIR=%PROJECT_ROOT%restore-points"
set "LOGFILE=%PROJECT_ROOT%restore.log"
set "ERRORLEVEL_OVERRIDE=0"

echo.                                                 | tee "%LOGFILE%"
echo [INFO] Restore started at %DATE% %TIME%          | tee -a "%LOGFILE%"
echo [INFO] Project: %PROJECT_ROOT%                   | tee -a "%LOGFILE%"
echo [INFO] Backups: %BACKUPS_DIR%                    | tee -a "%LOGFILE%"
echo [INFO] Log:     %LOGFILE%                        | tee -a "%LOGFILE%"
echo.                                                 | tee -a "%LOGFILE%"

REM Validate backups folder
if not exist "%BACKUPS_DIR%" (
  echo [ERR] Backups folder not found: "%BACKUPS_DIR%"          | tee -a "%LOGFILE%"
  set "ERRORLEVEL_OVERRIDE=1"
  goto :END
)

REM Build newest-first list of backup folders
set /a COUNT=0
for /f "delims=" %%A in ('dir /ad /b /o-d "%BACKUPS_DIR%" 2^>nul') do (
  set /a COUNT+=1
  set "OPT!COUNT!=%%A"
)

if %COUNT% EQU 0 (
  echo [ERR] No backups found in "%BACKUPS_DIR%".                | tee -a "%LOGFILE%"
  set "ERRORLEVEL_OVERRIDE=1"
  goto :END
)

REM Determine target backup
set "SELECTED="
set "ARG=%~1"

if /I "%ARG%"=="latest" (
  call set "SELECTED=%%OPT1%%"
) else if not "%ARG%"=="" (
  if exist "%BACKUPS_DIR%\%ARG%" (
    set "SELECTED=%ARG%"
  ) else (
    echo [ERR] Backup "%ARG%" not found under "backups\".        | tee -a "%LOGFILE%"
    echo [INFO] Available:                                        | tee -a "%LOGFILE%"
    for /l %%I in (1,1,%COUNT%) do call echo    - %%OPT%%I%%      | tee -a "%LOGFILE%"
    set "ERRORLEVEL_OVERRIDE=1"
    goto :END
  )
) else (
  echo Available backups (newest first):                          | tee -a "%LOGFILE%"
  for /l %%I in (1,1,%COUNT%) do call echo   %%I^) %%OPT%%I%%     | tee -a "%LOGFILE%"
  echo.
  set /p "CHOICE=Enter number to restore (default 1 = latest): "
  if "%CHOICE%"=="" set "CHOICE=1"
  for /f "delims=0123456789" %%Z in ("%CHOICE%") do (
    echo [ERR] Invalid selection.                                 | tee -a "%LOGFILE%"
    set "ERRORLEVEL_OVERRIDE=1"
    goto :END
  )
  if %CHOICE% LSS 1 (
    echo [ERR] Selection out of range.                            | tee -a "%LOGFILE%"
    set "ERRORLEVEL_OVERRIDE=1"
    goto :END
  )
  if %CHOICE% GTR %COUNT% (
    echo [ERR] Selection out of range.                            | tee -a "%LOGFILE%"
    set "ERRORLEVEL_OVERRIDE=1"
    goto :END
  )
  call set "SELECTED=%%OPT%CHOICE%%%"
)

set "SRC=%BACKUPS_DIR%\%SELECTED%"
echo.                                                             | tee -a "%LOGFILE%"
echo [INFO] Selected backup: "%SELECTED%"                         | tee -a "%LOGFILE%"
echo [INFO] Source path:     "%SRC%"                              | tee -a "%LOGFILE%"
echo [INFO] Dest (project):  "%PROJECT_ROOT%"                     | tee -a "%LOGFILE%"
echo.                                                             | tee -a "%LOGFILE%"

REM Confirm
choice /M "Proceed with restore" /C YN /N
if errorlevel 2 (
  echo [INFO] Aborted by user.                                    | tee -a "%LOGFILE%"
  goto :END
)

REM Create pre-restore snapshot of current project
for /f %%T in ('powershell -NoProfile -Command "(Get-Date).ToString('yyyyMMdd-HHmmss')"') do set "TS=%%T"
set "SNAP=%SNAP_DIR%\%TS%"
echo [INFO] Creating pre-restore snapshot: "%SNAP%"               | tee -a "%LOGFILE%"
mkdir "%SNAP%" >nul 2>&1

REM Use robocopy to snapshot (exclude backups, snapshots, .git, node_modules)
robocopy "%PROJECT_ROOT%" "%SNAP%" /E /R:0 /W:0 /NFL /NDL /NJH /NJS /NP /MT:8 ^
  /XD "%BACKUPS_DIR%" "%SNAP_DIR%" "%PROJECT_ROOT%.git" "%PROJECT_ROOT%node_modules" ^
  /LOG+:"%LOGFILE%"
set "RC_SNAP=%ERRORLEVEL%"
if %RC_SNAP% GEQ 8 (
  echo [WARN] Snapshot copy returned code %RC_SNAP%. Continuing.  | tee -a "%LOGFILE%"
) else (
  echo [OK]   Snapshot complete.                                  | tee -a "%LOGFILE%"
)

echo.                                                             | tee -a "%LOGFILE%"
echo [MODE] Y = MIRROR (delete extras) / N = COPY (keep extras)   | tee -a "%LOGFILE%"
choice /C YN /N /M "Mirror destination to match backup? [y/N]: "
set "ROBO_FLAGS="
if errorlevel 2 (
  set "ROBO_FLAGS=/E /IS /IT /COPY:DAT /DCOPY:DAT /R:0 /W:0 /NFL /NDL /NJH /NJS /NP /MT:8 /TEE /LOG+:%LOGFILE%"
  echo [INFO] Using COPY mode (non-destructive).                  | tee -a "%LOGFILE%"
) else (
  set "ROBO_FLAGS=/MIR /COPY:DAT /DCOPY:DAT /R:0 /W:0 /NFL /NDL /NJH /NJS /NP /MT:8 /TEE /LOG+:%LOGFILE%"
  echo [INFO] Using MIRROR mode (DELETES extras).                  | tee -a "%LOGFILE%"
)

echo.                                                             | tee -a "%LOGFILE%"
echo [RUN] Restoring from "%SRC%"                                 | tee -a "%LOGFILE%"
robocopy "%SRC%" "%PROJECT_ROOT%" %ROBO_FLAGS%
set "RC=%ERRORLEVEL%"

echo.                                                             | tee -a "%LOGFILE%"
if %RC% GEQ 8 (
  echo [ERR] Robocopy returned code %RC% (failure).               | tee -a "%LOGFILE%"
  echo [INFO] A snapshot of your pre-restore project is here:     | tee -a "%LOGFILE%"
  echo        "%SNAP%"                                            | tee -a "%LOGFILE%"
  set "ERRORLEVEL_OVERRIDE=%RC%"
) else (
  echo [OK] Restore finished (robocopy code %RC%).                | tee -a "%LOGFILE%"
  echo      0/1 are normal success codes.                         | tee -a "%LOGFILE%"
)

:END
echo.                                                             | tee -a "%LOGFILE%"
echo [NEXT] If everything looks good:                             | tee -a "%LOGFILE%"
echo        git add -A                                            | tee -a "%LOGFILE%"
echo        git commit -m "Restore from backup %SELECTED%"        | tee -a "%LOGFILE%"
echo        git push origin main                                  | tee -a "%LOGFILE%"
echo.                                                             | tee -a "%LOGFILE%"
echo [INFO] Full log saved to: "%LOGFILE%"
echo. 
pause
endlocal && exit /b %ERRORLEVEL_OVERRIDE%

REM ──────────────────────────────────────────────────────────────────────────
REM Poor-man's tee for cmd.exe (writes to screen AND to file)
:tee
setlocal EnableDelayedExpansion
set "_TEE_FILE=%~1"
set "_TEE_LINE="
for /f "delims=" %%L in ('more') do (
  set "_TEE_LINE=%%L"
  echo(! _TEE_LINE!
  >> "%_TEE_FILE%" echo(! _TEE_LINE!
)
endlocal & exit /b
