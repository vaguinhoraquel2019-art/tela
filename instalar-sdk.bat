@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)

title Instalando Android SDK
color 0A

echo.
echo ======================================================
echo   INSTALANDO ANDROID SDK
echo   Aguarde, pode demorar 10-20 minutos...
echo ======================================================
echo.

set "SDK_ROOT=C:\Users\Wagner AMD\AppData\Local\Android\Sdk"
set "TOOLS_DIR=%SDK_ROOT%\cmdline-tools\latest"
set "SDKMANAGER=%TOOLS_DIR%\bin\sdkmanager.bat"

:: ── Baixa command line tools se nao existir ──────────────────
if not exist "%SDKMANAGER%" (
    echo Baixando Android Command Line Tools...
    echo Aguarde...

    set "TOOLS_ZIP=%TEMP%\cmdtools.zip"

    powershell -Command ^
        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
        "$url = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip';" ^
        "Invoke-WebRequest -Uri $url -OutFile '%TEMP%\cmdtools.zip' -UseBasicParsing"

    if not exist "%TEMP%\cmdtools.zip" (
        color 0C
        echo ERRO: Download falhou. Verifique sua internet.
        pause
        exit /b 1
    )

    echo Extraindo...
    powershell -Command ^
        "Expand-Archive -Path '%TEMP%\cmdtools.zip' -DestinationPath '%TEMP%\cmdtools_extract' -Force"

    :: Cria estrutura correta
    if not exist "%TOOLS_DIR%" mkdir "%TOOLS_DIR%"
    powershell -Command ^
        "Copy-Item -Path '%TEMP%\cmdtools_extract\cmdline-tools\*' -Destination '%TOOLS_DIR%' -Recurse -Force"

    echo Download concluido.
)

if not exist "%SDKMANAGER%" (
    color 0C
    echo ERRO: sdkmanager nao encontrado apos download.
    pause
    exit /b 1
)

echo sdkmanager OK.
echo.

:: ── Localiza Java ────────────────────────────────────────────
set "JAVA_HOME="
for /d %%d in ("C:\Program Files\Eclipse Adoptium\jdk-*") do set "JAVA_HOME=%%d"
for /d %%d in ("C:\Program Files\Amazon Corretto\jdk*") do set "JAVA_HOME=%%d"
for /d %%d in ("C:\Program Files\Android\Android Studio\jbr") do set "JAVA_HOME=%%d"
set "PATH=%JAVA_HOME%\bin;%PATH%"

:: ── Aceita todas as licenças primeiro ───────────────────────
echo Aceitando licencas do Android SDK...
powershell -Command "$sdkmanager = '%SDKMANAGER%'; $sdk = '%SDK_ROOT%'; $input = 'y`ny`ny`ny`ny`ny`ny`ny`n'; $input | & $sdkmanager --sdk_root=$sdk --licenses 2>&1"

:: ── Instala componentes ───────────────────────────────────────
echo [1/3] Instalando Platform Tools e Build Tools...
"%SDKMANAGER%" --sdk_root="%SDK_ROOT%" --install "platform-tools" "build-tools;34.0.0" 2>&1

echo [2/3] Instalando Android 14 (API 34)...
"%SDKMANAGER%" --sdk_root="%SDK_ROOT%" --install "platforms;android-34" 2>&1

echo [3/3] Instalando extras...
"%SDKMANAGER%" --sdk_root="%SDK_ROOT%" --install "extras;android;m2repository" 2>&1

:: ── Resultado ────────────────────────────────────────────────
if exist "%SDK_ROOT%\build-tools" (
    color 0A
    echo.
    echo ======================================================
    echo   ANDROID SDK INSTALADO COM SUCESSO!
    echo.
    echo   Agora execute: ABRIR-COMO-ADMIN.bat
    echo ======================================================
) else (
    color 0C
    echo.
    echo ======================================================
    echo   ERRO: SDK nao instalado corretamente.
    echo   Verifique sua conexao com a internet e tente novamente.
    echo ======================================================
)

echo.
pause
