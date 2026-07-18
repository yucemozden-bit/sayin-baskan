@echo off
title SAYIN BASKAN - Oyun Sunucusu
cd /d "%~dp0"
echo.
echo   SAYIN BASKAN sunucusu baslatiliyor...
echo   Tarayicida acilacak: http://localhost:8080
echo.
echo   (Bu pencereyi KAPATMA - oyun calisirken acik kalmali.)
echo   Durdurmak icin bu pencerede Ctrl+C yap ya da pencereyi kapat.
echo.
start "" http://localhost:8080
node serve.js
pause
