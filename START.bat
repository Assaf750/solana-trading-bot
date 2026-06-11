@echo off
title SOLTRADE - Solana Copy-Trading Engine
cd /d "%~dp0"

echo.
echo  ============================================
echo   SOLTRADE - تشغيل البرنامج
echo  ============================================
echo.

REM Build the UI once if it has never been built
if not exist "apps\operator-ui\dist\index.html" (
  echo  [1/2] بناء الواجهة لأول مرة... قد يستغرق دقيقة
  pushd apps\operator-ui
  if not exist "node_modules" call npm install
  call npm run build
  popd
)

echo  [2/2] تشغيل الخادم المحلي...
echo.
start "" http://127.0.0.1:8787
node apps\server\src\index.mjs
pause
