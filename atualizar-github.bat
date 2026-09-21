@echo off
title Atualizar GitHub
color 0A

echo.
echo ======================================================
echo   ENVIANDO ATUALIZACOES PARA O GITHUB
echo ======================================================
echo.

git add .
git commit -m "Adiciona Procfile para deploy no Railway"
git push

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ERRO ao enviar. Verifique sua conexao e tente novamente.
    echo.
    pause
    exit /b 1
)

color 0A
echo.
echo ======================================================
echo   ATUALIZADO COM SUCESSO!
echo ======================================================
echo.
echo Agora va ao Railway e clique em "tela" para fazer o deploy.
echo https://railway.app/new
echo.
pause
