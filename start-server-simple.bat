@echo off
echo Starting HTTP Server on port 8000...
echo Open your browser to: http://localhost:8000
echo Press Ctrl+C to stop the server
cd /d "D:\AI"
python -m http.server 8000
pause