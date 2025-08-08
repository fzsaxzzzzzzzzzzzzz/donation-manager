@echo off
title 오버레이 로컬 서버
echo ========================================
echo          오버레이 로컬 서버 시작
echo ========================================
echo.
echo 이 서버를 통해 다른 컴퓨터에서도 오버레이에 접근할 수 있습니다.
echo.

:: 현재 IP 주소 확인
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set LOCAL_IP=%%b
        goto :found
    )
)
:found

echo 내 IP 주소: %LOCAL_IP%
echo.

:: Python 버전 확인
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Python이 감지되었습니다. Python 웹서버를 시작합니다...
    echo.
    echo 다른 컴퓨터에서 접근할 URL:
    echo   - 후원자 오버레이: http://%LOCAL_IP%:8080/donor-overlay.html
    echo   - 스트리머 테이블: http://%LOCAL_IP%:8080/streamer-table-overlay.html
    echo   - 후원 관리: http://%LOCAL_IP%:8080/donation-manager.html
    echo.
    echo 서버를 중지하려면 Ctrl+C를 누르세요.
    echo.
    python -m http.server 8080
    goto :end
)

:: Node.js 확인
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo Node.js가 감지되었습니다. http-server를 설치하고 시작합니다...
    echo.
    npm install -g http-server
    echo.
    echo 다른 컴퓨터에서 접근할 URL:
    echo   - 후원자 오버레이: http://%LOCAL_IP%:8080/donor-overlay.html
    echo   - 스트리머 테이블: http://%LOCAL_IP%:8080/streamer-table-overlay.html
    echo   - 후원 관리: http://%LOCAL_IP%:8080/donation-manager.html
    echo.
    echo 서버를 중지하려면 Ctrl+C를 누르세요.
    echo.
    http-server -p 8080 -c-1
    goto :end
)

echo ❌ Python이나 Node.js가 설치되어 있지 않습니다.
echo.
echo 다음 중 하나를 설치한 후 다시 실행해주세요:
echo.
echo 1. Python (권장): https://python.org
echo    설치 후: python -m http.server 8080
echo.
echo 2. Node.js: https://nodejs.org
echo    설치 후: npx http-server -p 8080
echo.
echo 3. 또는 sync-helper.html을 열어서 URL 파라미터 방식을 사용하세요.
echo.

:end
pause