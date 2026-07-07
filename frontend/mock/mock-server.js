import jsonServer from 'json-server';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import { Server } from 'socket.io';

const __dirname = dirname(fileURLToPath(import.meta.url));
const server = jsonServer.create();
const router = jsonServer.router(join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

const httpServer = http.createServer(server);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('Socket client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Socket client disconnected:', socket.id);
  });
});

// Envelope wrapper: wrap all responses in { success: true, data: ... }
server.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && 'success' in body) {
      return originalJson(body);
    }
    return originalJson({ success: true, data: body });
  };
  next();
});

// Mock auth endpoints
server.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Email and password required' },
    });
  }

  const db = router.db;
  const user = db.get('users').find({ email: email.toLowerCase() }).value();

  if (user) {
    res.json({
      success: true,
      data: {
        token: 'mock-token-' + user.id,
        user,
      },
    });
  } else {
    // Fallback: dynamic member user
    const memberUser = {
      id: 'u_' + email.replace(/[^a-zA-Z0-9]/g, ''),
      name: email.split('@')[0].toUpperCase(),
      email: email.toLowerCase(),
      isActive: true,
      roleId: 'member',
    };
    res.json({
      success: true,
      data: {
        token: 'mock-token-' + memberUser.id,
        user: memberUser,
      },
    });
  }
});

server.post('/api/v1/auth/register', (req, res) => {
  const { name, email } = req.body;
  const userId = 'u_' + (email || 'user').replace(/[^a-zA-Z0-9]/g, '');
  const newUser = { id: userId, name: name || 'New User', email, roleId: 'member' };
  
  const db = router.db;
  const exists = db.get('users').find({ email }).value();
  if (!exists) {
    db.get('users').push(newUser).write();
  }

  res.json({
    success: true,
    data: {
      token: 'mock-token-' + userId,
      user: newUser,
    },
  });
});

// Mock permissions endpoint
server.get('/api/v1/user/permissions', (req, res) => {
  const authHeader = req.headers.authorization;
  let userId = 'u1';
  if (authHeader && authHeader.startsWith('Bearer mock-token-')) {
    userId = authHeader.replace('Bearer mock-token-', '');
  }

  let permissions = [];

  if (userId === 'u1') {
    permissions = [
      { module: 'societies', action: 'view', accessLevel: 'admin' },
      { module: 'events', action: 'view', accessLevel: 'admin' },
      { module: 'projects', action: 'view', accessLevel: 'admin' },
      { module: 'reports', action: 'view', accessLevel: 'admin' },
      { module: 'announcements', action: 'view', accessLevel: 'admin' },
      { module: 'community', action: 'view', accessLevel: 'read' },
      { module: 'users', action: 'view', accessLevel: 'superadmin' },
    ];
  } else if (userId === 'u2') {
    permissions = [
      { module: 'societies', action: 'view', accessLevel: 'admin' },
      { module: 'events', action: 'view', accessLevel: 'admin' },
      { module: 'projects', action: 'view', accessLevel: 'admin' },
      { module: 'reports', action: 'view', accessLevel: 'admin' },
      { module: 'announcements', action: 'view', accessLevel: 'admin' },
      { module: 'community', action: 'view', accessLevel: 'read' },
      { module: 'users', action: 'view', accessLevel: 'none' },
    ];
  } else if (userId === 'u3') {
    permissions = [
      { module: 'societies', action: 'view', accessLevel: 'read' },
      { module: 'events', action: 'view', accessLevel: 'write' },
      { module: 'projects', action: 'view', accessLevel: 'write' },
      { module: 'reports', action: 'view', accessLevel: 'admin' },
      { module: 'announcements', action: 'view', accessLevel: 'read' },
      { module: 'community', action: 'view', accessLevel: 'read' },
      { module: 'users', action: 'view', accessLevel: 'none' },
    ];
  } else {
    // General Member permissions (no users/admin or reports module access)
    permissions = [
      { module: 'societies', action: 'view', accessLevel: 'none' },
      { module: 'events', action: 'view', accessLevel: 'read' },
      { module: 'projects', action: 'view', accessLevel: 'read' },
      { module: 'reports', action: 'view', accessLevel: 'none' },
      { module: 'announcements', action: 'view', accessLevel: 'read' },
      { module: 'community', action: 'view', accessLevel: 'write' },
      { module: 'users', action: 'view', accessLevel: 'none' },
    ];
  }

  res.json({
    success: true,
    data: { permissions },
  });
});

// Mock change-password endpoint
server.post('/api/v1/auth/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Current and new password are required' },
    });
  }
  res.json({ success: true, data: null });
});

// Mock access check
server.post('/api/v1/access/check', (req, res) => {
  res.json({
    success: true,
    data: { accessLevel: 'admin' },
  });
});

// Mock health endpoint
server.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', uptime: process.uptime(), version: '1.0.0' },
  });
});

// Map /api/v1/<resource> to /<resource>
const resourceMap = {
  '/api/v1/users': '/users',
  '/api/v1/societies': '/societies',
  '/api/v1/events': '/events',
  '/api/v1/projects': '/projects',
  '/api/v1/reports': '/reports',
  '/api/v1/announcements': '/announcements',
  '/api/v1/community/messages': '/communityMessages',
};

Object.entries(resourceMap).forEach(([apiPath, dbPath]) => {
  server.get(apiPath, (req, res) => {
    const db = router.db;
    let items = db.get(dbPath.replace('/', '')).value();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / limit);
    items = items.slice((page - 1) * limit, page * limit);
    res.json({
      success: true,
      data: items,
      meta: { page, limit, totalItems, totalPages },
    });
  });

  server.get(`${apiPath}/:id`, (req, res) => {
    const db = router.db;
    const item = db.get(dbPath.replace('/', '')).find({ id: req.params.id }).value();
    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
    }
    res.json({ success: true, data: item });
  });

  server.post(apiPath, (req, res) => {
    const db = router.db;
    const authHeader = req.headers.authorization;
    let currentUserId = 'u1';
    if (authHeader && authHeader.startsWith('Bearer mock-token-')) {
      currentUserId = authHeader.replace('Bearer mock-token-', '');
    }

    const extraFields = {};
    if (apiPath === '/api/v1/community/messages' || apiPath === '/api/v1/reports' || apiPath === '/api/v1/announcements') {
      extraFields.authorId = currentUserId;
    }

    const newItem = {
      id: 'mock-' + Date.now(),
      ...extraFields,
      ...req.body,
      createdAt: new Date().toISOString(),
    };
    db.get(dbPath.replace('/', '')).push(newItem).write();
    if (apiPath === '/api/v1/community/messages') {
      io.emit('community:message', newItem);
    }
    res.status(201).json({ success: true, data: newItem });
  });

  server.patch(`${apiPath}/:id`, (req, res) => {
    const db = router.db;
    const collection = db.get(dbPath.replace('/', ''));
    const item = collection.find({ id: req.params.id }).value();
    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
    }
    collection.find({ id: req.params.id }).assign(req.body).write();
    const updated = collection.find({ id: req.params.id }).value();
    res.json({ success: true, data: updated });
  });

  server.delete(`${apiPath}/:id`, (req, res) => {
    const db = router.db;
    const collection = db.get(dbPath.replace('/', ''));
    const item = collection.find({ id: req.params.id }).value();
    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
    }
    collection.remove({ id: req.params.id }).write();
    res.json({ success: true, data: null });
  });
});

server.use(router);

const PORT = 5000;
httpServer.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}/api/v1`);
});
