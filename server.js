const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Segurança e middlewares ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'screenshare-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Estado em memória ───────────────────────────────────────────────────────
const rooms   = new Map(); // roomId → RoomData
const users   = new Map(); // username → UserData
const roles   = new Map(); // roleId  → RoleData

// ─── Cargos padrão ───────────────────────────────────────────────────────────
const defaultRoles = [
  {
    id: uuidv4(),
    name: 'Administrador',
    color: '#2563eb',
    permissions: {
      viewDashboard:    true,
      manageSessions:   true,
      manageUsers:      true,
      manageRoles:      true,
      manageConfig:     true,
      createSession:    true,
      viewSessions:     true,
      endAnySessions:   true
    },
    createdAt: new Date().toISOString(),
    isDefault: true
  },
  {
    id: uuidv4(),
    name: 'Moderador',
    color: '#7c3aed',
    permissions: {
      viewDashboard:    true,
      manageSessions:   true,
      manageUsers:      false,
      manageRoles:      false,
      manageConfig:     false,
      createSession:    true,
      viewSessions:     true,
      endAnySessions:   true
    },
    createdAt: new Date().toISOString(),
    isDefault: true
  },
  {
    id: uuidv4(),
    name: 'Apresentador',
    color: '#059669',
    permissions: {
      viewDashboard:    false,
      manageSessions:   false,
      manageUsers:      false,
      manageRoles:      false,
      manageConfig:     false,
      createSession:    true,
      viewSessions:     true,
      endAnySessions:   false
    },
    createdAt: new Date().toISOString(),
    isDefault: true
  },
  {
    id: uuidv4(),
    name: 'Espectador',
    color: '#64748b',
    permissions: {
      viewDashboard:    false,
      manageSessions:   false,
      manageUsers:      false,
      manageRoles:      false,
      manageConfig:     false,
      createSession:    false,
      viewSessions:     true,
      endAnySessions:   false
    },
    createdAt: new Date().toISOString(),
    isDefault: true
  }
];
defaultRoles.forEach(r => roles.set(r.id, r));

// Usuário admin padrão (senha: admin123)
const adminHash = bcrypt.hashSync('admin123', 10);
users.set('admin', {
  id: uuidv4(),
  username: 'admin',
  password: adminHash,
  role: 'admin',
  email: 'admin@seunomeaqui.com',
  createdAt: new Date().toISOString()
});

// Configurações do site (personalizáveis)
let siteConfig = {
  orgName:      'SEU NOME AQUI',
  orgLogo:      null,
  primaryColor: '#2563eb',
  accentColor:  '#1d4ed8',
  bgColor:      '#0f172a',
  tagline:      'Conectando pessoas onde você estiver.',
  description:  'Compartilhamento de tela simples, seguro e totalmente personalizado para a sua organização.',
  allowGuests:  true,
  maxViewers:   50,
  sessionTimeout: 120
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function createRoom(hostId, hostName) {
  const roomId = uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase();
  const room = {
    id: roomId,
    hostId,
    hostName,
    viewers: new Map(),
    status: 'waiting',   // waiting | live | ended
    createdAt: new Date().toISOString(),
    startedAt: null,
    endedAt: null,
    duration: 0,
    viewerCount: 0
  };
  rooms.set(roomId, room);
  return room;
}

function getRoomStats(room) {
  return {
    id:          room.id,
    hostName:    room.hostName,
    status:      room.status,
    viewerCount: room.viewers.size,
    createdAt:   room.createdAt,
    startedAt:   room.startedAt,
    endedAt:     room.endedAt,
    duration:    room.startedAt
      ? Math.floor((Date.now() - new Date(room.startedAt).getTime()) / 1000)
      : 0
  };
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(401).json({ error: 'Acesso não autorizado' });
}

// ─── Rotas de páginas ────────────────────────────────────────────────────────
app.get('/',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/room/:id',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'room.html')));
app.get('/view/:id',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'viewer.html')));

// ─── API: Configurações públicas ─────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  const { orgName, orgLogo, primaryColor, accentColor, bgColor, tagline, description } = siteConfig;
  res.json({ orgName, orgLogo, primaryColor, accentColor, bgColor, tagline, description });
});

// ─── API: Autenticação ───────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ success: true, user: { username: user.username, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  res.status(401).json({ error: 'Não autenticado' });
});

// ─── API: Salas ──────────────────────────────────────────────────────────────
app.post('/api/rooms/create', (req, res) => {
  const hostName = req.session.user?.username || req.body.guestName || 'Responsável';
  const hostId   = req.session.user?.id || uuidv4();
  const room     = createRoom(hostId, hostName);
  res.json({ success: true, roomId: room.id, room: getRoomStats(room) });
});

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Sala não encontrada' });
  res.json(getRoomStats(room));
});

app.get('/api/rooms/:id/exists', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase());
  if (!room) return res.json({ exists: false });
  res.json({ exists: true, status: room.status });
});

// ─── API: Admin ───────────────────────────────────────────────────────────────
app.get('/api/admin/rooms', requireAdmin, (req, res) => {
  const allRooms = Array.from(rooms.values()).map(getRoomStats);
  res.json(allRooms);
});

app.get('/api/admin/rooms/active', requireAdmin, (req, res) => {
  const active = Array.from(rooms.values())
    .filter(r => r.status === 'live' || r.status === 'waiting')
    .map(getRoomStats);
  res.json(active);
});

app.delete('/api/admin/rooms/:id', requireAdmin, (req, res) => {
  const roomId = req.params.id.toUpperCase();
  const room   = rooms.get(roomId);
  if (!room) return res.status(404).json({ error: 'Sala não encontrada' });
  io.to(roomId).emit('session-ended', { reason: 'Sessão encerrada pelo administrador' });
  room.status  = 'ended';
  room.endedAt = new Date().toISOString();
  res.json({ success: true });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const list = Array.from(users.values()).map(u => ({
    id: u.id, username: u.username, role: u.role,
    roleId: u.roleId || null, roleName: u.roleName || null,
    email: u.email, createdAt: u.createdAt
  }));
  res.json(list);
});

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const { username, password, role, email, roleId } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
  if (users.has(username)) return res.status(409).json({ error: 'Usuário já existe' });
  const assignedRole = roleId && roles.has(roleId) ? roles.get(roleId) : null;
  users.set(username, {
    id: uuidv4(), username,
    password: bcrypt.hashSync(password, 10),
    role: role || 'user',
    roleId: roleId || null,
    roleName: assignedRole ? assignedRole.name : null,
    email: email || '',
    createdAt: new Date().toISOString()
  });
  res.json({ success: true });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const list = Array.from(users.values()).map(u => ({
    id: u.id, username: u.username, role: u.role,
    roleId: u.roleId || null, roleName: u.roleName || null,
    email: u.email, createdAt: u.createdAt
  }));
  res.json(list);
});

app.delete('/api/admin/users/:username', requireAdmin, (req, res) => {
  if (req.params.username === 'admin') return res.status(403).json({ error: 'Não é possível remover o admin padrão' });
  users.delete(req.params.username);
  res.json({ success: true });
});

app.put('/api/admin/users/:username/role', requireAdmin, (req, res) => {
  const user = users.get(req.params.username);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const { roleId } = req.body;
  if (roleId) {
    const role = roles.get(roleId);
    if (!role) return res.status(404).json({ error: 'Cargo não encontrado' });
    user.roleId   = roleId;
    user.roleName = role.name;
  } else {
    user.roleId   = null;
    user.roleName = null;
  }
  res.json({ success: true });
});

app.get('/api/admin/config', requireAdmin, (req, res) => {
  res.json(siteConfig);
});

app.put('/api/admin/config', requireAdmin, (req, res) => {
  siteConfig = { ...siteConfig, ...req.body };
  res.json({ success: true, config: siteConfig });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const allRooms   = Array.from(rooms.values());
  const liveRooms  = allRooms.filter(r => r.status === 'live');
  const totalViews = allRooms.reduce((acc, r) => acc + r.viewerCount, 0);
  res.json({
    activeSessions: liveRooms.length,
    totalSessions:  allRooms.length,
    totalUsers:     users.size,
    totalViewers:   totalViews,
    uptime:         process.uptime(),
    version:        '1.0.0',
    serverStatus:   'Online'
  });
});

// ─── API: Cargos ─────────────────────────────────────────────────────────────
app.get('/api/admin/roles', requireAdmin, (req, res) => {
  res.json(Array.from(roles.values()));
});

app.post('/api/admin/roles', requireAdmin, (req, res) => {
  const { name, color, permissions } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome do cargo obrigatório' });

  const id = uuidv4();
  const role = {
    id,
    name: name.trim(),
    color: color || '#2563eb',
    permissions: {
      viewDashboard:  permissions?.viewDashboard  || false,
      manageSessions: permissions?.manageSessions || false,
      manageUsers:    permissions?.manageUsers    || false,
      manageRoles:    permissions?.manageRoles    || false,
      manageConfig:   permissions?.manageConfig   || false,
      createSession:  permissions?.createSession  || false,
      viewSessions:   permissions?.viewSessions   || false,
      endAnySessions: permissions?.endAnySessions || false
    },
    createdAt: new Date().toISOString(),
    isDefault: false
  };
  roles.set(id, role);
  res.json({ success: true, role });
});

app.put('/api/admin/roles/:id', requireAdmin, (req, res) => {
  const role = roles.get(req.params.id);
  if (!role) return res.status(404).json({ error: 'Cargo não encontrado' });
  const { name, color, permissions, isDefault } = req.body;
  if (name)                    role.name        = name.trim();
  if (color)                   role.color       = color;
  if (permissions)             role.permissions = { ...role.permissions, ...permissions };
  if (isDefault !== undefined) role.isDefault   = isDefault;
  res.json({ success: true, role });
});

app.delete('/api/admin/roles/:id', requireAdmin, (req, res) => {
  const role = roles.get(req.params.id);
  if (!role) return res.status(404).json({ error: 'Cargo não encontrado' });
  // Permite deletar qualquer cargo, inclusive padrão (já confirmado no cliente)
  roles.delete(req.params.id);
  res.json({ success: true });
});

// ─── API: ICE Servers (TURN dinâmico) ────────────────────────────────────────
app.get('/api/ice-servers', async (req, res) => {
  const meteredApiKey = process.env.METERED_API_KEY;
  const meteredDomain = process.env.METERED_DOMAIN;

  if (meteredApiKey && meteredDomain) {
    try {
      const response = await fetch(
        `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredApiKey}`
      );
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log('[TURN] Credenciais Metered carregadas:', data.length, 'servidores');
          return res.json(data);
        }
      }
    } catch(e) {
      console.error('[TURN] Erro Metered:', e.message);
    }
  }

  // Fallback estático confiável
  console.log('[TURN] Usando servidores fallback');
  res.json([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]);
});

// ─── Socket.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Conectado: ${socket.id}`);

  // ── Responsável: entra na sala ──────────────────────────────────────────
  socket.on('host-join', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) { socket.emit('error', { message: 'Sala não encontrada' }); return; }

    room.hostSocketId = socket.id;
    room.status       = 'live';
    room.startedAt    = room.startedAt || new Date().toISOString();
    socket.join(roomId);
    socket.roomId = roomId;
    socket.role   = 'host';

    socket.emit('host-joined', { roomId, room: getRoomStats(room) });
    io.to(roomId).emit('room-updated', getRoomStats(room));
    console.log(`[Room] Host entrou: ${roomId}`);
  });

  // ── Espectador: entra na sala ────────────────────────────────────────────
  socket.on('viewer-join', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) { socket.emit('error', { message: 'Sala não encontrada' }); return; }
    if (room.status === 'ended') { socket.emit('session-ended', { reason: 'Esta sessão foi encerrada' }); return; }

    room.viewers.set(socket.id, { joinedAt: new Date().toISOString() });
    room.viewerCount = Math.max(room.viewerCount, room.viewers.size);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.role   = 'viewer';

    socket.emit('viewer-joined', { roomId, status: room.status, room: getRoomStats(room) });
    io.to(roomId).emit('room-updated', getRoomStats(room));

    // Notifica o host que um novo espectador entrou
    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit('viewer-connected', { viewerId: socket.id, count: room.viewers.size });
    }
    console.log(`[Room] Viewer entrou: ${roomId} (total: ${room.viewers.size})`);
  });

  // ── Viewer pede offer ao host ─────────────────────────────────────────────
  socket.on('request-offer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || !room.hostSocketId) return;
    // Encaminha o pedido ao host com o ID do viewer que pediu
    io.to(room.hostSocketId).emit('request-offer', { viewerId: socket.id });
    console.log(`[Room] Viewer ${socket.id} pediu offer ao host da sala ${roomId}`);
  });

  // ── WebRTC: signaling ────────────────────────────────────────────────────
  socket.on('offer', ({ roomId, offer, targetId }) => {
    const target = targetId ? io.sockets.sockets.get(targetId) : null;
    if (target) {
      target.emit('offer', { offer, from: socket.id });
    } else {
      socket.to(roomId).emit('offer', { offer, from: socket.id });
    }
  });

  socket.on('answer', ({ roomId, answer, targetId }) => {
    const target = io.sockets.sockets.get(targetId);
    if (target) target.emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ roomId, candidate, targetId }) => {
    const target = targetId ? io.sockets.sockets.get(targetId) : null;
    if (target) {
      target.emit('ice-candidate', { candidate, from: socket.id });
    } else {
      socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
    }
  });

  // ── Host encerra a sessão ─────────────────────────────────────────────────
  socket.on('end-session', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.status  = 'ended';
    room.endedAt = new Date().toISOString();
    io.to(roomId).emit('session-ended', { reason: 'O responsável encerrou a sessão' });
    console.log(`[Room] Sessão encerrada: ${roomId}`);
  });

  // ── Desconexão ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const { roomId, role } = socket;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    if (role === 'host') {
      room.status  = 'ended';
      room.endedAt = new Date().toISOString();
      io.to(roomId).emit('session-ended', { reason: 'O responsável se desconectou' });
      console.log(`[Room] Host desconectou, sessão encerrada: ${roomId}`);
    } else if (role === 'viewer') {
      room.viewers.delete(socket.id);
      io.to(roomId).emit('room-updated', getRoomStats(room));
      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('viewer-disconnected', { viewerId: socket.id, count: room.viewers.size });
      }
    }
    console.log(`[Socket] Desconectado: ${socket.id}`);
  });
});

// ─── Inicia o servidor ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`   Admin: http://localhost:${PORT}/admin`);
  console.log(`   Login: admin / admin123\n`);
});
