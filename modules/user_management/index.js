'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const moduleJson = require('./module.json');
const log = require('../../shared/services/log');
const db = require('../../shared/services/db');
const auth = require('../../shared/services/auth');

const BCRYPT_ROUNDS = 10;
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'changeme123';
const DEFAULT_ADMIN_EMAIL = 'admin@timsys.local';
const DEFAULT_ADMIN_PERMISSIONS = ['admin:users:read', 'admin:users:write', 'admin:*'];

/**
 * User Management Module
 * Provides authentication and user CRUD operations.
 */

async function boot(ctx) {
  log.info('user_management booting', { module: moduleJson.name });

  // Seed default admin if no users exist
  const count = db.query(`SELECT COUNT(*) as count FROM users`).rows[0].count;
  if (count === 0) {
    const hash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, BCRYPT_ROUNDS);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.query(
      `INSERT INTO users (id, username, email, password_hash, permissions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL, hash, JSON.stringify(DEFAULT_ADMIN_PERMISSIONS), now, now]
    );

    log.info('Default admin user created', {
      module: moduleJson.name,
      username: DEFAULT_ADMIN_USERNAME,
      warning: 'Change default password immediately',
    });

    ctx.events.publish('user.created', { userId: id, username: DEFAULT_ADMIN_USERNAME, seeded: true });
  }
}

function teardown(ctx) {
  log.info('user_management tearing down', { module: moduleJson.name });
}

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, sessionId }
 */
function user_management_login(req, ctx) {
  const { username, password } = req.body;

  if (!username || !password) {
    return {
      statusCode: 400,
      data: {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Username and password required' },
      },
    };
  }

  const result = db.query(
    `SELECT id, username, email, password_hash, permissions FROM users WHERE username = ?`,
    [username]
  );

  if (result.rows.length === 0) {
    return {
      statusCode: 401,
      data: {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
      },
    };
  }

  const user = result.rows[0];
  const valid = bcrypt.compareSync(password, user.password_hash);

  if (!valid) {
    return {
      statusCode: 401,
      data: {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
      },
    };
  }

  const permissions = JSON.parse(user.permissions);
  const token = auth.issueToken({ id: user.id, permissions });
  const session = auth.createSession(user.id, { username: user.username, email: user.email });

  log.audit('user.login', user.id, { entityType: 'user', entityId: user.id });

  return {
    statusCode: 200,
    data: {
      success: true,
      token,
      sessionId: session.sessionId,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        permissions,
      },
    },
  };
}

/**
 * POST /api/auth/logout
 * Requires auth. Revokes current token + destroys session.
 */
function user_management_logout(req, ctx) {
  const authHeader = ctx.headers?.authorization || '';
  // The token comes from the request — we need it from the HTTP layer
  // Since the HTTP layer extracts it, we'll revoke based on user ID
  auth.revokeAllUserTokens(req.user.id, 'logout');
  auth.destroyUserSessions(req.user.id, 'logout');

  log.audit('user.logout', req.user.id, { entityType: 'user', entityId: req.user.id });

  return {
    statusCode: 200,
    data: {
      success: true,
      message: 'Logged out',
    },
  };
}

/**
 * GET /api/auth/me
 * Requires auth. Returns current user info.
 */
function user_management_getMe(req, ctx) {
  // req.user should be set by HTTP middleware
  if (!req.user) {
    return {
      statusCode: 401,
      data: {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      },
    };
  }

  const result = db.query(
    `SELECT id, username, email, permissions, created_at, updated_at FROM users WHERE id = ?`,
    [req.user.id]
  );

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      data: {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      },
    };
  }

  const user = result.rows[0];
  return {
    statusCode: 200,
    data: {
      success: true,
      user: {
        ...user,
        permissions: JSON.parse(user.permissions),
      },
    },
  };
}

function user_management_listUsers(req, ctx) {
  if (!auth.checkPerm(req.user, 'admin:users:read')) {
    return {
      statusCode: 403,
      data: {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      },
    };
  }

  const result = db.query(
    `SELECT id, username, email, permissions, created_at, updated_at FROM users ORDER BY created_at DESC`
  );

  return {
    statusCode: 200,
    data: {
      success: true,
      users: result.rows.map((u) => ({
        ...u,
        permissions: JSON.parse(u.permissions),
      })),
      total: result.rows.length,
    },
  };
}

/**
 * POST /api/users
 * Requires auth + admin:users:write permission.
 * Body: { username, email, password, permissions }
 */

function user_management_createUser(req, ctx) {
  // Permission check
  if (!req.user || !auth.checkPerm(req.user, 'admin:users:write')) {
    return {
      statusCode: 403,
      data: {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      },
    };
  }
  
  const { username, email, password, permissions } = req.body;

  if (!username || !email || !password) {
    return {
      statusCode: 400,
      data: {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Username, email, and password required' },
      },
    };
  }

  // Check for duplicates
  const existing = db.query(
    `SELECT id FROM users WHERE username = ? OR email = ?`,
    [username, email]
  );

  if (existing.rows.length > 0) {
    return {
      statusCode: 409,
      data: {
        success: false,
        error: { code: 'CONFLICT', message: 'Username or email already exists' },
      },
    };
  }

  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const now = Date.now();
  const id = crypto.randomUUID();
  const perms = permissions || [];

  db.query(
    `INSERT INTO users (id, username, email, password_hash, permissions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, username, email, hash, JSON.stringify(perms), now, now]
  );

  log.audit('user.create', req.user.id, {
    entityType: 'user',
    entityId: id,
    newValue: { username, email, permissions: perms },
  });

  ctx.events.publish('user.created', { userId: id, username, createdBy: req.user.id });

  return {
    statusCode: 201,
    data: {
      success: true,
      user: {
        id,
        username,
        email,
        permissions: perms,
        created_at: now,
        updated_at: now,
      },
    },
  };
}

/**
 * GET /api/users/:id
 * Requires auth + admin:users:read permission.
 */
function user_management_getUser(req, ctx) {
  if (!auth.checkPerm(req.user, 'admin:users:read')) {
    return {
      statusCode: 403,
      data: {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      },
    };
  }

  const result = db.query(
    `SELECT id, username, email, permissions, created_at, updated_at FROM users WHERE id = ?`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      data: {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      },
    };
  }

  const user = result.rows[0];
  return {
    statusCode: 200,
    data: {
      success: true,
      user: {
        ...user,
        permissions: JSON.parse(user.permissions),
      },
    },
  };
}

/**
 * PUT /api/users/:id
 * Requires auth + admin:users:write permission.
 * Body: { username?, email?, password?, permissions? }
 */
function user_management_updateUser(req, ctx) {
  if (!auth.checkPerm(req.user, 'admin:users:write')) {
    return {
      statusCode: 403,
      data: {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      },
    };
  }

  const { id } = req.params;
  const { username, email, password, permissions } = req.body;

  // Check user exists
  const existing = db.query(
    `SELECT id, username, email, password_hash, permissions FROM users WHERE id = ?`,
    [id]
  );

  if (existing.rows.length === 0) {
    return {
      statusCode: 404,
      data: {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      },
    };
  }

  const current = existing.rows[0];
  const updates = [];
  const params = [];
  const oldValue = {
    username: current.username,
    email: current.email,
    permissions: JSON.parse(current.permissions),
  };

  if (username) {
    updates.push('username = ?');
    params.push(username);
  }
  if (email) {
    updates.push('email = ?');
    params.push(email);
  }
  if (password) {
    updates.push('password_hash = ?');
    params.push(bcrypt.hashSync(password, BCRYPT_ROUNDS));
  }
  if (permissions) {
    updates.push('permissions = ?');
    params.push(JSON.stringify(permissions));
  }

  if (updates.length === 0) {
    return {
      statusCode: 400,
      data: {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No fields to update' },
      },
    };
  }

  updates.push('updated_at = ?');
  params.push(Date.now());
  params.push(id);

  db.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  const newValue = { username: username || oldValue.username, email: email || oldValue.email, permissions: permissions || oldValue.permissions };

  log.audit('user.update', req.user.id, {
    entityType: 'user',
    entityId: id,
    oldValue,
    newValue,
  });

  ctx.events.publish('user.updated', { userId: id, updatedBy: req.user.id, fields: Object.keys(req.body) });

  return {
    statusCode: 200,
    data: {
      success: true,
      user: {
        id,
        username: username || oldValue.username,
        email: email || oldValue.email,
        permissions: permissions || oldValue.permissions,
      },
    },
  };
}

/**
 * DELETE /api/users/:id
 * Requires auth + admin:users:write permission.
 */
function user_management_deleteUser(req, ctx) {
  if (!auth.checkPerm(req.user, 'admin:users:write')) {
    return {
      statusCode: 403,
      data: {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      },
    };
  }

  const { id } = req.params;

  // Can't delete yourself
  if (id === req.user.id) {
    return {
      statusCode: 400,
      data: {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Cannot delete your own account' },
      },
    };
  }

  const existing = db.query(`SELECT id, username FROM users WHERE id = ?`, [id]);

  if (existing.rows.length === 0) {
    return {
      statusCode: 404,
      data: {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      },
    };
  }

  // Revoke all tokens and sessions for deleted user
  auth.forceLogout(id, 'account_deleted');

  db.query(`DELETE FROM users WHERE id = ?`, [id]);

  log.audit('user.delete', req.user.id, {
    entityType: 'user',
    entityId: id,
    oldValue: existing.rows[0],
  });

  ctx.events.publish('user.deleted', { userId: id, deletedBy: req.user.id });

  return {
    statusCode: 200,
    data: {
      success: true,
      message: 'User deleted',
    },
  };
}

module.exports = {
  boot,
  teardown,
  user_management_login,
  user_management_logout,
  user_management_getMe,
  user_management_listUsers,
  user_management_createUser,
  user_management_getUser,
  user_management_updateUser,
  user_management_deleteUser,
};