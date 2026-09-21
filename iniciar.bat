@echo off
title Plataforma de Compartilhamento de Tela
color 0A

echo.
echo ======================================================
echo   PLATAFORMA DE COMPARTILHAMENTO DE TELA
echo ======================================================
echo.

:: ── Verifica dependencias ────────────────────────────────────────
if not exist "node_modules\" (
    color 0E
    echo AVISO: Dependencias nao instaladas.
    echo.
    echo Execute primeiro o arquivo:  instalar.bat
    echo.
    pause
    exit /b 1
)

:: ── Localiza Node.js ─────────────────────────────────────────────
set "NODE_EXE="

node --version >nul 2>&1
if %errorlevel% equ 0 (
    set "NODE_EXE=node"
    goto :start_server
)

if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
    goto :start_server
)

if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
    goto :start_server
)

color 0C
echo ERRO: Node.js nao encontrado.
echo Execute instalar.bat primeiro.
echo.
pause
exit /b 1

:start_server
echo Servidor iniciando em: http://localhost:3000
echo.
echo Pressione Ctrl+C para encerrar.
echo.

:: Abre o navegador apos 2 segundos
start "" cmd /c "timeout /t 2 >nul && start http://localhost:3000"

"%NODE_EXE%" server.js

echo.
echo Servidor encerrado.
pause
