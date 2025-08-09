@echo off
echo ===============================================
echo    🚀 실시간 후원 관리 시스템 시작
echo ===============================================
echo.
echo Node.js 패키지 설치 중...
call npm install
echo.
echo 서버 시작 중...
echo 관리자 페이지: http://localhost:3000/donation-manager-realtime.html
echo 후원자 오버레이: http://localhost:3000/overlay-realtime.html
echo 스트리머 테이블: http://localhost:3000/table-realtime.html
echo.
echo Ctrl+C를 눌러 종료하세요
echo ===============================================
echo.
node server.js
pause