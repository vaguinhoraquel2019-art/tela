/* ═══════════════════════════════════════════════════════════════
   WEBRTC HOST — Responsável pela transmissão
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

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ── Estado ───────────────────────────────────────────────────────
const roomId      = window.location.pathname.split('/').pop().toUpperCase();
let socket        = null;
let localStream   = null;
let isSharing     = false;
let sessionStart  = null;
let timerInterval = null;
let elapsed       = 0;
const peers       = new Map(); // viewerId → RTCPeerConnection
const viewers     = new Set();

// ICE servers (STUN públicos)
const iceConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]
};

// ── DOM ──────────────────────────────────────────────────────────
const video         = document.getElementById('localVideo');
const placeholder   = document.getElementById('video-placeholder');
const liveBadge     = document.getElementById('live-badge');
const videoTimer    = document.getElementById('video-timer');
const videoArea     = document.getElementById('video-area');
const statusBadge   = document.getElementById('status-badge');
const statusWaiting = document.getElementById('status-waiting');
const viewerCountEl = document.getElementById('viewer-count-top');
const sessionLinkEl = document.getElementById('session-link-display');
const infoRoomId    = document.getElementById('info-room-id');
const infoStatus    = document.getElementById('info-status');
const infoCreated   = document.getElementById('info-created');
const infoDuration  = document.getElementById('info-duration');
const infoViewers   = document.getElementById('info-viewers');
const viewersList   = document.getElementById('viewers-list');
const viewersEmpty  = document.getElementById('viewers-empty');
const idPill        = document.getElementById('session-id-pill');
const endedScreen   = document.getElementById('ended-screen');
const endedReason   = document.getElementById('ended-reason');
const loadingScreen = document.getElementById('loading-screen');

// ── Inicialização ─────────────────────────────────────────────────
async function init() {
  // Carrega config de personalização
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    if (cfg.orgName) {
      document.title = `Sessão Ativa — ${cfg.orgName}`;
      document.querySelectorAll('#topbar-name').forEach(e => e.textContent = cfg.orgName);
    }
    if (cfg.primaryColor) {
      document.documentElement.style.setProperty('--primary', cfg.primaryColor);
      document.documentElement.style.setProperty('--primary-dark', cfg.accentColor || cfg.primaryColor);
    }
    if (cfg.orgLogo) {
      document.querySelectorAll('#topbar-logo').forEach(el => {
        el.innerHTML = `<img src="${cfg.orgLogo}" alt="Logo" />`;
        el.style.cssText = 'background:transparent;border:none;padding:0;';
      });
    }
  } catch (e) { /* sem config */ }

  // Verifica se a sala existe
  try {
    const res  = await fetch(`/api/rooms/${roomId}`);
    const room = await res.json();
    if (room.error) { showEnded('Sala não encontrada.'); return; }

    idPill.textContent = `ID: ${roomId}`;
    infoRoomId.textContent = roomId;
    infoCreated.textContent = formatDateTime(room.createdAt);
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/view/${roomId}`;
    sessionLinkEl.textContent = link;
    document.getElementById('mockup-url-text') && (document.getElementById('mockup-url-text').textContent = link);
  } catch (e) {
    showEnded('Erro ao carregar a sessão.');
    return;
  }

  loadingScreen.style.display = 'none';
  connectSocket();
}

// ── Socket.IO ────────────────────────────────────────────────────
function connectSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('[Socket] Conectado como host');
    socket.emit('host-join', { roomId });
  });

  socket.on('host-joined', ({ room }) => {
    sessionStart = Date.now();
    startTimer();
    showToast('Sala criada! Compartilhe o link com os espectadores.', 'success');
    updateStatus('live');
  });

  socket.on('viewer-connected', ({ viewerId, count }) => {
    console.log('[Viewer] Conectou:', viewerId);
    viewers.add(viewerId);
    updateViewerCount(count);
    renderViewers();
    showToast(`Novo espectador conectado (${count} total)`, 'info', 3000);
    if (isSharing) sendOfferToViewer(viewerId);
  });

  socket.on('viewer-disconnected', ({ viewerId, count }) => {
    viewers.delete(viewerId);
    closePeer(viewerId);
    updateViewerCount(count);
    renderViewers();
  });

  socket.on('answer', ({ answer, from }) => {
    const pc = peers.get(from);
    if (pc) pc.setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on('ice-candidate', ({ candidate, from }) => {
    const pc = peers.get(from);
    if (pc && candidate) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  });

  socket.on('room-updated', (room) => {
    updateViewerCount(room.viewerCount);
    infoViewers.textContent = room.viewerCount;
    if (room.duration) {
      const secs = room.duration;
      infoDuration.textContent = formatTime(secs);
    }
  });

  socket.on('session-ended', ({ reason }) => {
    showEnded(reason);
  });

  socket.on('error', ({ message }) => {
    showToast(message, 'error');
  });

  socket.on('disconnect', () => {
    showToast('Conexão perdida. Reconectando...', 'warning');
  });
}

// ── WebRTC: criar peer para um viewer ───────────────────────────
async function createPeerForViewer(viewerId) {
  const pc = new RTCPeerConnection(iceConfig);
  peers.set(viewerId, pc);

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.emit('ice-candidate', { roomId, candidate, targetId: viewerId });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[Peer ${viewerId}] Estado: ${pc.connectionState}`);
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      closePeer(viewerId);
    }
  };

  return pc;
}

async function sendOfferToViewer(viewerId) {
  const pc    = await createPeerForViewer(viewerId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', { roomId, offer, targetId: viewerId });
}

function closePeer(viewerId) {
  const pc = peers.get(viewerId);
  if (pc) { pc.close(); peers.delete(viewerId); }
}

// ── Compartilhamento de tela ─────────────────────────────────────
async function startScreenShare() {
  try {
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always', frameRate: 30 },
      audio: false
    });

    video.srcObject = localStream;
    video.style.display = 'block';
    placeholder.style.display = 'none';
    liveBadge.classList.add('show');
    videoTimer.classList.add('show');
    videoArea.classList.add('sharing');
    isSharing = true;
    infoStatus.textContent = 'Transmitindo';

    // Envia stream para todos os viewers já conectados
    for (const viewerId of viewers) {
      await sendOfferToViewer(viewerId);
    }

    showToast('Transmissão iniciada!', 'success');

    // Quando o usuário para via browser (botão "Stop sharing")
    localStream.getVideoTracks()[0].addEventListener('ended', () => {
      stopScreenShare(false);
    });
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
      showToast('Permissão negada ou cancelada.', 'warning');
    } else {
      showToast('Erro ao capturar a tela: ' + err.message, 'error');
    }
  }
}

function stopScreenShare(notify = true) {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  video.srcObject = null;
  video.style.display = 'none';
  placeholder.style.display = 'flex';
  liveBadge.classList.remove('show');
  videoArea.classList.remove('sharing');
  isSharing = false;
  infoStatus.textContent = 'Parado';

  peers.forEach((pc, id) => closePeer(id));

  if (notify) showToast('Compartilhamento de tela pausado.', 'info');
}

// ── Timer ────────────────────────────────────────────────────────
function startTimer() {
  if (timerInterval) return;
  sessionStart = sessionStart || Date.now();
  timerInterval = setInterval(() => {
    elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const formatted = formatTime(elapsed);
    videoTimer.textContent = formatted;
    infoDuration.textContent = formatTime(elapsed);
  }, 1000);
}

// ── UI Helpers ───────────────────────────────────────────────────
function updateStatus(status) {
  if (status === 'live') {
    statusBadge.style.display  = 'flex';
    statusWaiting.style.display = 'none';
    infoStatus.textContent = 'Ao Vivo';
  } else {
    statusBadge.style.display  = 'none';
    statusWaiting.style.display = 'flex';
  }
}

function updateViewerCount(count) {
  viewerCountEl.textContent = `👥 ${count} espectador${count !== 1 ? 'es' : ''}`;
  infoViewers.textContent   = count;
}

function renderViewers() {
  const count = viewers.size;
  viewersEmpty.style.display = count === 0 ? 'block' : 'none';
  const existing = viewersList.querySelectorAll('.viewer-item');
  existing.forEach(el => el.remove());
  let i = 1;
  viewers.forEach(id => {
    const el = document.createElement('div');
    el.className = 'viewer-item';
    el.innerHTML = `
      <div class="viewer-avatar">${i}</div>
      <span class="viewer-name">Espectador ${i}</span>
      <div class="dot-pulse"></div>
    `;
    viewersList.appendChild(el);
    i++;
  });
}

function showEnded(reason) {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  stopScreenShare(false);
  endedReason.textContent = reason || 'A sessão foi encerrada.';
  endedScreen.classList.add('show');
}

// ── Botões de controle ───────────────────────────────────────────
document.getElementById('btn-start-share').addEventListener('click', startScreenShare);
document.getElementById('ctrl-screen').addEventListener('click', () => {
  isSharing ? stopScreenShare() : startScreenShare();
});
document.getElementById('ctrl-stop').addEventListener('click', () => {
  document.getElementById('modal-end').classList.add('open');
});

// Copiar link
document.getElementById('btn-copy-link').addEventListener('click', () => {
  const link = sessionLinkEl.textContent;
  navigator.clipboard.writeText(link).then(() => {
    showToast('Link copiado para a área de transferência!', 'success', 3000);
  }).catch(() => {
    showToast('Não foi possível copiar automaticamente.', 'warning');
  });
});

// Modal encerrar sessão
document.getElementById('btn-end-session').addEventListener('click', () => {
  document.getElementById('modal-end').classList.add('open');
});
document.getElementById('modal-end-close').addEventListener('click', () => {
  document.getElementById('modal-end').classList.remove('open');
});
document.getElementById('modal-end-cancel').addEventListener('click', () => {
  document.getElementById('modal-end').classList.remove('open');
});
document.getElementById('btn-confirm-end').addEventListener('click', () => {
  if (socket) socket.emit('end-session', { roomId });
  document.getElementById('modal-end').classList.remove('open');
  showEnded('Você encerrou a sessão.');
});

document.getElementById('btn-new-after-end').addEventListener('click', async () => {
  try {
    const res  = await fetch('/api/rooms/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json();
    if (data.success) window.location.href = `/room/${data.roomId}`;
  } catch(e) { window.location.href = '/'; }
});

// Botões mic/câmera (placeholders — requerem getUserMedia separado)
document.getElementById('ctrl-mic').addEventListener('click', function() {
  this.classList.toggle('active');
  showToast('Microfone ' + (this.classList.contains('active') ? 'ativado' : 'desativado'), 'info', 2000);
});
document.getElementById('ctrl-cam').addEventListener('click', function() {
  this.classList.toggle('active');
  showToast('Câmera ' + (this.classList.contains('active') ? 'ativada' : 'desativada'), 'info', 2000);
});

// ── Inicia ───────────────────────────────────────────────────────
init();
