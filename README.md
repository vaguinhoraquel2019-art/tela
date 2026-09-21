# 🖥️ Plataforma de Compartilhamento de Tela

Sistema completo de compartilhamento de tela em tempo real, personalizável para qualquer organização.
Funciona direto no navegador, sem instalação de aplicativos pelos participantes.

---

## ✨ Funcionalidades

- **Compartilhamento de tela ao vivo** via WebRTC — sem plugins ou downloads
- **Link exclusivo por sessão** — envie para qualquer pessoa assistir
- **Painel administrativo** — gerencie sessões, usuários e configurações
- **Personalização completa** — nome, logo, cores e textos da organização
- **Design responsivo** — funciona em computador, tablet e celular
- **Modo escuro** — interface profissional e moderna
- **Sem cadastro para espectadores** — acesso pelo link, sem complicação

---

## 📋 Pré-requisitos

- [Node.js](https://nodejs.org/) versão **16 ou superior**

---

## 🚀 Instalação e uso

### Windows (recomendado)

1. Baixe ou clone este repositório
2. Clique duas vezes em **`instalar.bat`** — instala todas as dependências automaticamente
3. Clique duas vezes em **`iniciar.bat`** — inicia o servidor e abre o navegador

### Manual (qualquer sistema)

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/seu-repositorio.git
cd seu-repositorio

# Instale as dependências
npm install

# Inicie o servidor
node server.js
```

Acesse: **http://localhost:3000**

---

## 🔐 Acesso ao painel admin

| Campo   | Valor     |
|---------|-----------|
| Usuário | `admin`   |
| Senha   | `admin123` |

> ⚠️ Altere a senha após o primeiro acesso em: **Admin → Configurações**

---

## 📄 Páginas do sistema

| URL           | Descrição                             |
|---------------|---------------------------------------|
| `/`           | Página inicial                        |
| `/login`      | Login do administrador                |
| `/admin`      | Painel administrativo                 |
| `/room/:id`   | Sala do responsável (quem transmite)  |
| `/view/:id`   | Sala do espectador (quem assiste)     |

---

## 🎨 Como personalizar

Acesse o painel admin → aba **Personalização** e configure:

| Campo              | Descrição                                      |
|--------------------|------------------------------------------------|
| Nome da organização| Substitui **"SEU NOME AQUI"** em todo o site   |
| Logo               | URL da imagem — substitui **"SUA LOGO AQUI"**  |
| Cor principal      | Cor dos botões e destaques                     |
| Cor de destaque    | Cor secundária do gradiente                    |
| Slogan             | Texto abaixo do nome no rodapé e hero          |
| Descrição          | Parágrafo da página inicial                    |

Todas as mudanças são aplicadas imediatamente em todo o site.

---

## 🗂️ Estrutura do projeto

```
📦 raiz/
├── 📄 server.js              ← Servidor Node.js (Express + Socket.IO)
├── 📄 package.json           ← Dependências
├── 📄 instalar.bat           ← Instalação automática (Windows)
├── 📄 iniciar.bat            ← Iniciar o servidor (Windows)
├── 📄 .gitignore
└── 📁 public/
    ├── 📄 index.html         ← Página inicial
    ├── 📄 login.html         ← Tela de login
    ├── 📄 admin.html         ← Painel administrativo
    ├── 📄 room.html          ← Sala do responsável
    ├── 📄 viewer.html        ← Sala do espectador
    ├── 📁 css/
    │   └── 📄 style.css      ← Estilos globais + variáveis CSS
    └── 📁 js/
        ├── 📄 webrtc-host.js    ← Lógica do transmissor
        └── 📄 webrtc-viewer.js  ← Lógica do espectador
```

---

## ⚙️ Tecnologias

| Camada    | Tecnologia                          |
|-----------|-------------------------------------|
| Servidor  | Node.js, Express, Socket.IO         |
| Tempo real| WebRTC (getDisplayMedia), Socket.IO |
| Segurança | bcryptjs, express-session, helmet   |
| Frontend  | HTML5, CSS3 (variáveis), JavaScript |

---

## 🔒 Segurança em produção

Para uso em produção, configure as seguintes variáveis de ambiente:

```bash
SESSION_SECRET=sua-chave-secreta-longa-e-aleatoria
PORT=3000
```

Recomendações adicionais:

- Use **HTTPS** — obrigatório para `getDisplayMedia` funcionar em produção
- Configure um servidor **TURN** para redes corporativas com firewall restrito
- Use um gerenciador de processos como [PM2](https://pm2.keymetrics.io/):
  ```bash
  npm install -g pm2
  pm2 start server.js --name "screenshare"
  pm2 startup
  ```

---

## 📌 Notas sobre personalização para diferentes clientes

O projeto foi desenvolvido como um **modelo reutilizável**. Os marcadores `SEU NOME AQUI` e `SUA LOGO AQUI` aparecem em todos os locais onde o conteúdo real do cliente deve ser inserido.

Para personalizar para um cliente específico:
1. Acesse o painel admin após instalar
2. Vá em **Personalização**
3. Preencha nome, logo e cores reais
4. Salve — as alterações se propagam automaticamente por todo o site

---

## 📜 Licença

Este projeto é um modelo personalizável. Adapte livremente para uso próprio ou de clientes.
