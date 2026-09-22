@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)

title Gerando APK - ScreenShare
color 0A

echo.
echo ======================================================
echo   GERANDO APK - SCREENSHARE
echo ======================================================
echo.

:: ── Remove JAVA_HOME do ambiente para nao conflitar ──────────
set "JAVA_HOME="
set "JDK_HOME="

:: ── SDK ──────────────────────────────────────────────────────
set "SDK=C:\Users\Wagner AMD\AppData\Local\Android\Sdk"
if not exist "%SDK%\build-tools" (
    color 0C
    echo ERRO: Android SDK nao encontrado.
    pause
    exit /b 1
)
echo [1/3] SDK OK.

:: ── Projeto ──────────────────────────────────────────────────
set "PRJ=C:\Users\Wagner AMD\AndroidStudioProjects\ScreenShare"
if not exist "%PRJ%\gradlew.bat" (
    color 0C
    echo ERRO: Projeto nao encontrado.
    pause
    exit /b 1
)
echo [2/3] Projeto OK.

:: ── Atualiza local.properties ─────────────────────────────────
powershell -NoProfile -Command "[System.IO.File]::WriteAllText('%PRJ%\local.properties', 'sdk.dir=C\:\\Users\\Wagner AMD\\AppData\\Local\\Android\\Sdk', [System.Text.Encoding]::ASCII)"

:: ── Limpa cache ───────────────────────────────────────────────
powershell -NoProfile -Command "Remove-Item '%PRJ%\.gradle' -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item 'C:\Users\Wagner AMD\.gradle\caches' -Recurse -Force -ErrorAction SilentlyContinue"

:: ── Compila ───────────────────────────────────────────────────
echo [3/3] Compilando APK (5-15 minutos)...
echo       Nao feche esta janela!
echo.

set "ANDROID_HOME=%SDK%"
set "ANDROID_SDK_ROOT=%SDK%"

cd /d "%PRJ%"
call gradlew.bat assembleDebug --no-daemon --warning-mode none

:: ── Resultado ─────────────────────────────────────────────────
set "APK=%PRJ%\app\build\outputs\apk\debug\app-debug.apk"
set "DESK=%USERPROFILE%\Desktop"

if exist "%APK%" (
    copy "%APK%" "%DESK%\ScreenShare.apk" >nul
    color 0A
    echo.
    echo ======================================================
    echo   APK GERADO COM SUCESSO!
    echo   Arquivo: %DESK%\ScreenShare.apk
    echo.
    echo   Para instalar no celular:
    echo   1. Envie pelo WhatsApp ou Google Drive
    echo   2. Abra o arquivo no celular
    echo   3. Permita instalar de fontes desconhecidas
    echo   4. Toque em Instalar
    echo ======================================================
) else (
    color 0C
    echo.
    echo ======================================================
    echo   ERRO: APK nao gerado.
    echo   Verifique os erros acima.
    echo ======================================================
)

echo.
pause
