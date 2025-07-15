@echo off
REM 1) Run the import script (updates Mongo & copies images)
node importNewRows.js
IF ERRORLEVEL 1 (
  echo IMPORT FAILED
  exit /b 1
)

REM 2) Stage all new/updated images
git add assets\grey_market\*.jpg

REM 3) Optionally stage CSV if it changed
git add grey_market_refs.csv

REM 4) Commit & push everything
git commit -m "Import new grey market records & images"
git push
