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
let retries  = 0;
const MAX_RETRIES = 3;

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
  [stateConnecting, stateWaiting, stateNotFound, stateEnded, stateError].forEach(el => {
    el.classList.remove('active');
  });
  const map = {
    connecting: stateConnecting,
    waiting:    stateWaiting,
    'not-found': stateNotFound,
    ended:      stateEnded,
    error:      stateError
  };
  if (map[name]) map[name].classList.add('active');
  remoteVideo.style.display = 'none';
}

function showVideo() {
  [stateConnecting, stateWaiting, stateNotFound, stateEnded, stateError].forEach(el => {
    el.classList.remove('active');
  });
  remoteVideo.style.display = 'block';
  liveBadge.classList.add('show');
}

// ── Inicialização ────────────────────────────────────────────────
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
  } catch (e) { /* sem config */ }

  // Verifica se a sala existe antes de conectar
  try {
    const res  = await fetch(`/api/rooms/${roomId}/exists`);
    const data = await res.json();
    if (!data.exists) { showState('not-found'); return; }
    if (data.status === 'ended') {
      showState('ended');
      document.getElementById('ended-reason-viewer').textContent = 'Esta sessão já foi encerrada.';
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

// ── Socket.IO ────────────────────────────────────────────────────
function connectSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('[Socket] Conectado como viewer');
    socket.emit('viewer-join', { roomId });
  });

  socket.on('viewer-joined', ({ status, room }) => {
    viewerCountLbl.textContent = `👥 ${room.viewerCount} visualizando`;
    if (status === 'live') {
      showState('waiting');
    } else {
      showState('waiting');
    }
  });

  socket.on('offer', async ({ offer, from }) => {
    console.log('[WebRTC] Recebeu offer de', from);
    await createPeer(from);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', { roomId, answer, targetId: from });
  });

  socket.on('ice-candidate', ({ candidate, from }) => {
    if (pc && candidate) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
        console.warn('[ICE] Erro ao adicionar candidato:', err);
      });
    }
  });

  socket.on('room-updated', (room) => {
    viewerCountLbl.textContent = `👥 ${room.viewerCount} visualizando`;
  });

  socket.on('session-ended', ({ reason }) => {
    document.getElementById('ended-reason-viewer').textContent = reason || 'A transmissão foi encerrada.';
    showState('ended');
    liveBadge.classList.remove('show');
    if (pc) { pc.close(); pc = null; }
  });

  socket.on('error', ({ message }) => {
    document.getElementById('error-msg-viewer').textContent = message;
    showState('error');
  });

  socket.on('disconnect', () => {
    if (remoteVideo.style.display === 'block') {
      showToast('Conexão perdida. Reconectando...', 'warning');
    }
  });

  socket.on('connect_error', () => {
    retries++;
    if (retries >= MAX_RETRIES) {
      showState('error');
      document.getElementById('error-msg-viewer').textContent =
        'Não foi possível conectar ao servidor. Verifique sua conexão.';
    }
  });
}

// ── WebRTC Peer ───────────────────────────────────────────────────
async function createPeer(hostId) {
  if (pc) { pc.close(); }

  pc = new RTCPeerConnection(iceConfig);

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.emit('ice-candidate', { roomId, candidate, targetId: hostId });
    }
  };

  pc.ontrack = (event) => {
    console.log('[WebRTC] Recebeu track:', event.track.kind);
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.onloadedmetadata = () => {
        remoteVideo.play().then(() => {
          showVideo();
          showToast('Transmissão conectada!', 'success', 3000);
        }).catch(e => console.error('[Video] Erro ao reproduzir:', e));
      };
    }
  };

  pc.onconnectionstatechange = () => {
    console.log('[Peer] Estado:', pc.connectionState);
    if (pc.connectionState === 'connected') {
      showToast('Conectado à transmissão', 'success', 2000);
    }
    if (pc.connectionState === 'failed') {
      showState('error');
      document.getElementById('error-msg-viewer').textContent =
        'Falha na conexão com o host. Tente recarregar a página.';
    }
    if (pc.connectionState === 'disconnected') {
      showState('waiting');
      liveBadge.classList.remove('show');
      showToast('Transmissão interrompida. Aguardando reconexão...', 'warning');
    }
  };
}

// ── Fullscreen ────────────────────────────────────────────────────
function toggleFullscreen() {
  const wrap = document.getElementById('viewer-video-wrap');
  if (!document.fullscreenElement) {
    (wrap.requestFullscreen || wrap.webkitRequestFullscreen || wrap.mozRequestFullScreen).call(wrap);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen).call(document);
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

// Retry
document.getElementById('btn-retry-viewer').addEventListener('click', () => {
  retries = 0;
  showState('connecting');
  if (socket) { socket.disconnect(); }
  connectSocket();
});

// ── Inicia ───────────────────────────────────────────────────────
init();
