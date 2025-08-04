@echo off
echo Starting HTTP Server on port 4001...
echo Open your browser to: http://localhost:4001
echo Press Ctrl+C to stop the server
cd /d D:\AI
python -m http.server 4001
pause