@echo off
title Postar no GitHub
color 0A

echo.
echo ======================================================
echo   POSTAR PROJETO NO GITHUB
echo ======================================================
echo.

:: ── Verifica se git esta instalado ──────────────────────────────
git --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ERRO: Git nao encontrado!
    echo.
    echo Instale o Git em: https://git-scm.com/download/win
    echo Apos instalar, reinicie o computador e execute novamente.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('git --version') do echo Git encontrado: %%v
echo.

:: ── Pede a URL do repositorio ────────────────────────────────────
echo Antes de continuar, crie um repositorio VAZIO no GitHub:
echo   1. Acesse https://github.com/new
echo   2. Escolha um nome para o repositorio
echo   3. Deixe em branco (sem README, sem .gitignore)
echo   4. Clique em "Create repository"
echo   5. Copie a URL que aparece (exemplo abaixo)
echo.
echo Exemplo de URL:
echo   https://github.com/seu-usuario/seu-repositorio.git
echo.
set /p REPO_URL=Cole aqui a URL do seu repositorio: 

if "%REPO_URL%"=="" (
    echo.
    echo ERRO: URL nao informada. Operacao cancelada.
    pause
    exit /b 1
)

echo.
echo URL informada: %REPO_URL%
echo.

:: ── Inicializa git se necessario ─────────────────────────────────
if not exist ".git\" (
    echo Inicializando repositorio Git local...
    git init
    echo.
)

:: ── Configura branch principal ───────────────────────────────────
git branch -M main 2>nul

:: ── Adiciona todos os arquivos ───────────────────────────────────
echo Adicionando arquivos ao commit...
git add .
echo.

:: ── Cria o commit ────────────────────────────────────────────────
echo Criando commit...
git commit -m "Projeto inicial - Plataforma de Compartilhamento de Tela"
echo.

:: ── Vincula ao repositorio remoto ───────────────────────────────
echo Conectando ao GitHub...
git remote remove origin 2>nul
git remote add origin %REPO_URL%
echo.

:: ── Envia para o GitHub ──────────────────────────────────────────
echo Enviando para o GitHub...
echo (Pode ser solicitado seu usuario e senha/token do GitHub)
echo.
git push -u origin main

if %errorlevel% neq 0 (
    color 0E
    echo.
    echo AVISO: Nao foi possivel enviar automaticamente.
    echo.
    echo Isso pode acontecer por dois motivos:
    echo.
    echo 1. Autenticacao necessaria:
    echo    - Acesse https://github.com/settings/tokens
    echo    - Gere um token com permissao "repo"
    echo    - Use o token como senha ao autenticar
    echo.
    echo 2. Branch diferente (tente o comando abaixo no terminal):
    echo    git push -u origin master
    echo.
    pause
    exit /b 1
)

:: ── Sucesso ──────────────────────────────────────────────────────
color 0A
echo.
echo ======================================================
echo   PROJETO ENVIADO PARA O GITHUB COM SUCESSO!
echo ======================================================
echo.
echo Acesse seu repositorio em:
echo %REPO_URL%
echo.
set /p ABRIR=Deseja abrir o repositorio no navegador? (S/N): 
if /i "%ABRIR%"=="S" (
    start %REPO_URL%
)

echo.
pause
