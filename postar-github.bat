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
    echo Pressione qualquer tecla para sair...
    pause >nul
    exit /b 1
)

for /f "tokens=*" %%v in ('git --version') do echo Git encontrado: %%v
echo.

:: ── Pede a URL do repositorio ────────────────────────────────────
echo Exemplo de URL:
echo   https://github.com/seu-usuario/seu-repositorio.git
echo.
set /p REPO_URL=Cole aqui a URL do seu repositorio GitHub: 
echo.

if "%REPO_URL%"=="" (
    color 0C
    echo ERRO: URL nao informada.
    echo.
    pause
    exit /b 1
)

echo URL recebida: %REPO_URL%
echo.

:: ── Inicializa git se necessario ─────────────────────────────────
if not exist ".git\" (
    echo Inicializando git local...
    git init
    if %errorlevel% neq 0 (
        color 0C
        echo ERRO ao inicializar git.
        pause
        exit /b 1
    )
    echo.
)

:: ── Configura branch main ────────────────────────────────────────
git branch -M main 2>nul

:: ── Adiciona arquivos ────────────────────────────────────────────
echo Adicionando arquivos...
git add .
if %errorlevel% neq 0 (
    color 0C
    echo ERRO ao adicionar arquivos.
    pause
    exit /b 1
)
echo Arquivos adicionados.
echo.

:: ── Cria commit ──────────────────────────────────────────────────
echo Criando commit...
git commit -m "Projeto inicial - Plataforma de Compartilhamento de Tela"
if %errorlevel% neq 0 (
    color 0E
    echo AVISO: Commit falhou. Pode ser que nao ha email configurado no git.
    echo Configurando email e nome padrao...
    git config user.email "usuario@exemplo.com"
    git config user.name "Usuario"
    git commit -m "Projeto inicial - Plataforma de Compartilhamento de Tela"
)
echo.

:: ── Vincula repositorio remoto ───────────────────────────────────
echo Conectando ao repositorio remoto...
git remote remove origin 2>nul
git remote add origin %REPO_URL%
echo.

:: ── Envia para o GitHub ──────────────────────────────────────────
echo Enviando arquivos para o GitHub...
echo (Se pedir senha, use seu TOKEN do GitHub, nao a senha normal)
echo.
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo Tentando com branch master...
    git push -u origin master
)

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ======================================================
    echo   ERRO AO ENVIAR PARA O GITHUB
    echo ======================================================
    echo.
    echo Possiveis causas:
    echo.
    echo 1. Token incorreto ou expirado
    echo    - Gere um novo em: https://github.com/settings/tokens
    echo    - Marque a permissao "repo"
    echo    - Use o token como SENHA quando solicitado
    echo.
    echo 2. Repositorio nao existe ou URL errada
    echo    - Confira a URL no GitHub
    echo.
    echo 3. Repositorio nao esta vazio
    echo    - Delete o repositorio e crie um novo vazio
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
echo Acesse: %REPO_URL%
echo.
set /p ABRIR=Deseja abrir o repositorio no navegador? (S/N): 
if /i "%ABRIR%"=="S" (
    start %REPO_URL%
)

echo.
echo Pressione qualquer tecla para fechar...
pause >nul
