@echo off
cd /d "%~dp0"
py -m http.server 8080 --bind 0.0.0.0
