/* ═══════════════════════════════════════════════════════════════
   WEBRTC VIEWER — Espectador da transmissão
   ═══════════════════════════════════════════════════════════════ */

// ── Utilitários ──────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 4000) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOut .3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── Estado ───────────────────────────────────────────────────────
const roomId = window.location.pathname.split('/').pop().toUpperCase();
let socket   = null;
let pc       = null;
let hostId   = null; // socket ID do host
let retries  = 0;
const MAX_RETRIES = 5;

const iceConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]
};

// ── DOM ──────────────────────────────────────────────────────────
const remoteVideo    = document.getElementById('remoteVideo');
const liveBadge      = document.getElementById('viewer-live-badge');
const sessionPill    = document.getElementById('viewer-session-pill');
const viewerCountLbl = document.getElementById('viewer-count-label');

const stateConnecting = document.getElementById('state-connecting');
const stateWaiting    = document.getElementById('state-waiting');
const stateNotFound   = document.getElementById('state-not-found');
const stateEnded      = document.getElementById('state-ended');
const stateError      = document.getElementById('state-error');

function showState(name) {
  [stateConnecting, stateWaiting, stateNotFound, stateEnded, stateError]
    .forEach(el => el.classList.remove('active'));

  const map = {
    connecting:  stateConnecting,
    waiting:     stateWaiting,
    'not-found': stateNotFound,
    ended:       stateEnded,
    error:       stateError
  };
  if (map[name]) map[name].classList.add('active');

  // Esconde vídeo ao mostrar qualquer tela de estado
  remoteVideo.style.display = 'none';
}

function showVideo() {
  [stateConnecting, stateWaiting, stateNotFound, stateEnded, stateError]
    .forEach(el => el.classList.remove('active'));
  remoteVideo.style.display = 'block';
  liveBadge.classList.add('show');
}

// ── Inicialização ─────────────────────────────────────────────────
async function init() {
  // Personalização
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    if (cfg.orgName) {
      document.title = `Visualizando — ${cfg.orgName}`;
      document.querySelectorAll('#viewer-org-name').forEach(e => e.textContent = cfg.orgName);
    }
    if (cfg.primaryColor) {
      document.documentElement.style.setProperty('--primary', cfg.primaryColor);
      document.documentElement.style.setProperty('--primary-dark', cfg.accentColor || cfg.primaryColor);
    }
    if (cfg.orgLogo) {
      document.querySelectorAll('#viewer-logo').forEach(el => {
        el.innerHTML = `<img src="${cfg.orgLogo}" alt="Logo" />`;
        el.style.cssText = 'background:transparent;border:none;padding:0;';
      });
    }
  } catch (e) {}

  // Verifica se a sala existe
  try {
    const res  = await fetch(`/api/rooms/${roomId}/exists`);
    const data = await res.json();
    if (!data.exists) { showState('not-found'); return; }
    if (data.status === 'ended') {
      document.getElementById('ended-reason-viewer').textContent = 'Esta sessão já foi encerrada.';
      showState('ended');
      return;
    }
    sessionPill.textContent = `ID: ${roomId}`;
  } catch (e) {
    showState('error');
    return;
  }

  showState('connecting');
  connectSocket();
}

// ── Socket.IO ─────────────────────────────────────────────────────
function connectSocket() {
  socket = io({ reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 2000 });

  socket.on('connect', () => {
    console.log('[Socket] Conectado como viewer');
    retries = 0;
    socket.emit('viewer-join', { roomId });
  });

  socket.on('viewer-joined', ({ status, room }) => {
    viewerCountLbl.textContent = `👥 ${room.viewerCount} visualizando`;
    // Aguarda o host enviar um offer
    showState('waiting');
  });

  socket.on('offer', async ({ offer, from }) => {
    console.log('[WebRTC] Recebeu offer de', from);
    hostId = from;
    try {
      await createPeer(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { roomId, answer, targetId: from });
    } catch (e) {
      console.error('[Offer] Erro ao processar:', e);
    }
  });

  socket.on('ice-candidate', ({ candidate, from }) => {
    if (pc && candidate) {
      // FIX: aguarda a descrição remota estar definida antes de adicionar candidatos
      const addCandidate = () => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
          console.warn('[ICE] Erro ao adicionar candidato:', err.message);
        });
      };

      if (pc.remoteDescription && pc.remoteDescription.type) {
        addCandidate();
      } else {
        // Aguarda até a descrição remota estar pronta
        const interval = setInterval(() => {
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            clearInterval(interval);
            addCandidate();
          }
        }, 100);
        setTimeout(() => clearInterval(interval), 5000);
      }
    }
  });

  socket.on('room-updated', (room) => {
    viewerCountLbl.textContent = `👥 ${room.viewerCount} visualizando`;
  });

  socket.on('session-ended', ({ reason }) => {
    document.getElementById('ended-reason-viewer').textContent =
      reason || 'A transmissão foi encerrada.';
    showState('ended');
    liveBadge.classList.remove('show');
    if (pc) { pc.close(); pc = null; }
  });

  socket.on('error', ({ message }) => {
    document.getElementById('error-msg-viewer').textContent = message;
    showState('error');
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Desconectado:', reason);
    // Não muda estado — Socket.IO vai reconectar automaticamente
  });

  socket.on('reconnect', () => {
    console.log('[Socket] Reconectado');
    socket.emit('viewer-join', { roomId });
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Erro de conexão:', err.message);
    retries++;
    if (retries >= MAX_RETRIES) {
      showState('error');
      document.getElementById('error-msg-viewer').textContent =
        'Não foi possível conectar ao servidor. Verifique sua conexão.';
    }
  });
}

// ── WebRTC Peer ───────────────────────────────────────────────────
async function createPeer(hId) {
  // Fecha peer anterior se existir
  if (pc) {
    pc.onconnectionstatechange = null;
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.close();
    pc = null;
  }

  pc = new RTCPeerConnection(iceConfig);

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.emit('ice-candidate', { roomId, candidate, targetId: hId });
    }
  };

  pc.ontrack = (event) => {
    console.log('[WebRTC] Track recebida:', event.track.kind);
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.onloadedmetadata = () => {
        remoteVideo.play()
          .then(() => {
            showVideo();
            showToast('Transmissão conectada!', 'success', 3000);
          })
          .catch(e => console.error('[Video] Erro ao reproduzir:', e));
      };
    }
  };

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    console.log('[Peer] Estado:', state);

    if (state === 'connected') {
      showToast('Conectado à transmissão', 'success', 2000);
    }

    // FIX: 'disconnected' é temporário — NÃO encerra nem muda estado
    // Apenas 'failed' indica erro real
    if (state === 'failed') {
      console.warn('[Peer] Falha na conexão WebRTC');
      showState('error');
      document.getElementById('error-msg-viewer').textContent =
        'Falha na conexão. Tente recarregar a página.';
    }
  };

  pc.onsignalingstatechange = () => {
    console.log('[Signaling] Estado:', pc.signalingState);
  };
}

// ── Fullscreen ────────────────────────────────────────────────────
function toggleFullscreen() {
  const wrap = document.getElementById('viewer-video-wrap');
  if (!document.fullscreenElement) {
    const fn = wrap.requestFullscreen || wrap.webkitRequestFullscreen || wrap.mozRequestFullScreen;
    if (fn) fn.call(wrap);
  } else {
    const fn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
    if (fn) fn.call(document);
  }
}

document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-fullscreen-float').addEventListener('click', toggleFullscreen);

// Picture-in-picture
document.getElementById('btn-pip').addEventListener('click', async () => {
  try {
    if (remoteVideo.style.display !== 'none' && document.pictureInPictureEnabled) {
      await remoteVideo.requestPictureInPicture();
    } else {
      showToast('PiP disponível apenas durante a transmissão.', 'info', 3000);
    }
  } catch(e) {
    showToast('Picture-in-Picture não disponível neste navegador.', 'warning', 3000);
  }
});

// Retry manual
document.getElementById('btn-retry-viewer').addEventListener('click', () => {
  retries = 0;
  showState('connecting');
  if (socket) { socket.disconnect(); socket = null; }
  if (pc) { pc.close(); pc = null; }
  setTimeout(connectSocket, 500);
});

// ── Inicia ────────────────────────────────────────────────────────
init();
