@echo off
echo Checking if Node.js is installed...
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed. Using Python server instead...
    python -m http.server 3000
) else (
    echo Starting Node.js HTTP Server on port 3000...
    echo Open your browser to: http://localhost:3000
    npx http-server . -p 3000 -c-1
)
pause