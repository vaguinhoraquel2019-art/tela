@echo off
title Instalador - Plataforma de Compartilhamento de Tela
color 0A

echo.
echo ======================================================
echo   PLATAFORMA DE COMPARTILHAMENTO DE TELA
echo   Instalacao Automatica
echo ======================================================
echo.

:: ── Localiza o executavel do Node.js ───────────────────────────
set "NODE_EXE="

:: Tenta no PATH normal
node --version >nul 2>&1
if %errorlevel% equ 0 (
    set "NODE_EXE=node"
    goto :node_ok
)

:: Tenta no local padrao de instalacao
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
    goto :node_ok
)

if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
    goto :node_ok
)

:: Tenta na pasta AppData do usuario
if exist "%APPDATA%\nvm\current\node.exe" (
    set "NODE_EXE=%APPDATA%\nvm\current\node.exe"
    goto :node_ok
)

:: Nao encontrou
color 0C
echo ERRO: Node.js nao encontrado!
echo.
echo Instale o Node.js em: https://nodejs.org/
echo Versao recomendada: 18 LTS ou superior
echo.
echo Apos instalar, reinicie o computador e execute este
echo arquivo novamente.
echo.
pause
exit /b 1

:node_ok
echo [1/3] Node.js encontrado.
for /f "tokens=*" %%v in ('"%NODE_EXE%" --version') do echo        Versao: %%v
echo.

:: ── Localiza o npm ──────────────────────────────────────────────
set "NPM_CLI="

if exist "%ProgramFiles%\nodejs\node_modules\npm\bin\npm-cli.js" (
    set "NPM_CLI=%ProgramFiles%\nodejs\node_modules\npm\bin\npm-cli.js"
    goto :npm_ok
)

if exist "%ProgramFiles(x86)%\nodejs\node_modules\npm\bin\npm-cli.js" (
    set "NPM_CLI=%ProgramFiles(x86)%\nodejs\node_modules\npm\bin\npm-cli.js"
    goto :npm_ok
)

color 0C
echo ERRO: npm nao encontrado!
echo Reinstale o Node.js em: https://nodejs.org/
echo.
pause
exit /b 1

:npm_ok
echo [2/3] npm encontrado.
echo.

:: ── Instala dependencias ─────────────────────────────────────────
echo [3/3] Instalando dependencias...
echo       (aguarde, pode demorar alguns segundos)
echo.

"%NODE_EXE%" "%NPM_CLI%" install

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ERRO: Falha na instalacao das dependencias.
    echo Verifique sua conexao com a internet e tente novamente.
    echo.
    pause
    exit /b 1
)

:: ── Concluido ────────────────────────────────────────────────────
color 0A
echo.
echo ======================================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ======================================================
echo.
echo Para iniciar o sistema execute:  iniciar.bat
echo.
echo Acesse no navegador:  http://localhost:3000
echo.
echo Login do painel admin:
echo   Usuario : admin
echo   Senha   : admin123
echo.
echo ======================================================
echo.

set /p INICIAR=Deseja iniciar o sistema agora? (S/N): 
if /i "%INICIAR%"=="S" (
    echo.
    echo Iniciando servidor...
    start "" cmd /k ""%NODE_EXE%" server.js"
    timeout /t 3 >nul
    start http://localhost:3000
    echo Pronto! Navegador aberto.
)

echo.
pause
