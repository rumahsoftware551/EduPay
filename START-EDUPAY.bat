@echo off
cd /d "%~dp0"
echo ==========================================
echo   EduPay - School Finance UI V2
echo ==========================================
echo.
echo Membuka aplikasi di http://localhost:8080
echo Jangan tutup jendela ini selama aplikasi dipakai.
echo.
start "" http://localhost:8080
where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8080
  goto :eof
)
where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 8080
  goto :eof
)
echo Python tidak ditemukan.
echo Silakan install Python atau jalankan dengan web server lokal lain.
pause
