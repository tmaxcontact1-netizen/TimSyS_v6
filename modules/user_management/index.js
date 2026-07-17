'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const email = require('../../shared/services/email');

var booted = false;

function boot(ctx) {
  ctx.log.info('user_management booting', { module: 'user_management' });
  booted = true;

  var userCount = ctx.db.query('SELECT COUNT(*) as count FROM users').rows[0].count;
  if (userCount === 0) {
    var adminPassword = bcrypt.hashSync('changeme123', 10);
    var adminId = crypto.randomUUID();
    var now = Date.now();
    ctx.db.query(
      'INSERT INTO users (id, username, email, password_hash, permissions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [adminId, 'admin', 'admin@timsys.local', adminPassword, JSON.stringify(['admin:users:read', 'admin:users:write', 'admin:*']), now, now]
    );
    ctx.log.info('Default admin user seeded', { module: 'user_management', userId: adminId });
  }
}

function teardown(ctx) {
  ctx.log.info('user_management tearing down', { module: 'user_management' });
  booted = false;
}

async function login(req, ctx) {
  var username = req.body.username;
  var password = req.body.password;

  if (!username || !password) {
    return { success: false, statusCode: 401, error: { code: 'UNAUTHORIZED', message: 'Username and password required' } };
  }

  var result = ctx.db.query('SELECT * FROM users WHERE username = ?', [username]);
  if (result.rows.length === 0) {
    return { success: false, statusCode: 401, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } };
  }

  var user = result.rows[0];
  var valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return { success: false, statusCode: 401, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } };
  }

  var permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
  var token = ctx.auth.issueToken({ id: user.id, permissions: permissions });
  var session = ctx.auth.createSession(user.id, { username: user.username, permissions: permissions });

  ctx.log.audit('user.login', user.id, { entityType: 'user', entityId: user.id });

  return {
    success: true,
    token: token,
    sessionId: session.sessionId,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      permissions: permissions,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
  };
}

async function logout(req, ctx) {
  var authHeader = req.headers.authorization;
  var token = authHeader.split(' ')[1];
  ctx.auth.revokeToken(token, 'user_logout');
  return { success: true, message: 'Logged out successfully' };
}

async function getMe(req, ctx) {
  var result = ctx.db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'User not found' } };
  }
  var user = result.rows[0];
  var permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      permissions: permissions,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
  };
}

async function forgotPassword(req, ctx) {
  var emailAddr = req.body.email;
  if (!emailAddr) {
    return { success: false, statusCode: 400, error: { code: 'BAD_REQUEST', message: 'Email required' } };
  }

  var userResult = ctx.db.query('SELECT id, username FROM users WHERE email = ?', [emailAddr]);
  if (userResult.rows.length === 0) {
    return { success: true, message: 'If an account exists with this email, a reset link has been sent.' };
  }

  var user = userResult.rows[0];
  var resetToken = crypto.randomUUID();
  var tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  var expiresAt = Date.now() + (3600 * 1000);

  ctx.db.query(
    'INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [crypto.randomUUID(), user.id, tokenHash, expiresAt, Date.now()]
  );

  try {
    email.initEmail();
    await email.sendPasswordReset(emailAddr, resetToken);
  } catch (err) {
    ctx.log.error('Failed to send password reset email', { error: err.message });
  }

  return { success: true, message: 'If an account exists with this email, a reset link has been sent.' };
}

async function resetPassword(req, ctx) {
  var token = req.body.token;
  var newPassword = req.body.newPassword;

  if (!token || !newPassword || newPassword.length < 8) {
    return { success: false, statusCode: 400, error: { code: 'BAD_REQUEST', message: 'Token and new password required (min 8 chars)' } };
  }

  var tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  var now = Date.now();

  var resetRecord = ctx.db.query(
    'SELECT pr.*, u.id as user_id FROM password_resets pr JOIN users u ON pr.user_id = u.id WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > ?',
    [tokenHash, now]
  );

  if (resetRecord.rows.length === 0) {
    return { success: false, statusCode: 400, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' } };
  }

  var resetRow = resetRecord.rows[0];
  var hashedPassword = bcrypt.hashSync(newPassword, 10);

  ctx.db.query('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hashedPassword, now, resetRow.user_id]);
  ctx.db.query('UPDATE password_resets SET used_at = ? WHERE id = ?', [now, resetRow.id]);
  ctx.auth.forceLogout(resetRow.user_id, 'password_reset');

  return { success: true, message: 'Password reset successful. Please log in with your new password.' };
}

async function listUsers(req, ctx) {
  if (!ctx.auth.checkPerm(req.user, 'admin:users:read')) {
    return { success: false, statusCode: 403, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } };
  }

  var result = ctx.db.query('SELECT * FROM users ORDER BY created_at DESC');
  var users = result.rows.map(function(u) {
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions,
      created_at: u.created_at,
      updated_at: u.updated_at,
    };
  });

  return { success: true, users: users, total: users.length };
}

async function createUser(req, ctx) {
  if (!ctx.auth.checkPerm(req.user, 'admin:users:write')) {
    return { success: false, statusCode: 403, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } };
  }

  var username = req.body.username;
  var emailAddr = req.body.email;
  var password = req.body.password;
  var permissions = req.body.permissions || [];

  if (!username || !emailAddr || !password) {
    return { success: false, statusCode: 400, error: { code: 'BAD_REQUEST', message: 'Username, email, and password required' } };
  }

  var existing = ctx.db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, emailAddr]);
  if (existing.rows.length > 0) {
    return { success: false, statusCode: 409, error: { code: 'CONFLICT', message: 'Username or email already exists' } };
  }

  var hashedPassword = bcrypt.hashSync(password, 10);
  var userId = crypto.randomUUID();
  var now = Date.now();

  ctx.db.query(
    'INSERT INTO users (id, username, email, password_hash, permissions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, username, emailAddr, hashedPassword, JSON.stringify(permissions), now, now]
  );

  ctx.log.audit('user.create', req.user.id, { entityType: 'user', entityId: userId, newValue: { username: username, email: emailAddr, permissions: permissions } });
  ctx.events.publish('user.created', { userId: userId, username: username });

  return {
    success: true,
    user: {
      id: userId,
      username: username,
      email: emailAddr,
      permissions: permissions,
      created_at: now,
      updated_at: now,
    },
  };
}

async function getUser(req, ctx) {
  if (!ctx.auth.checkPerm(req.user, 'admin:users:read')) {
    return { success: false, statusCode: 403, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } };
  }

  var result = ctx.db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  var u = result.rows[0];
  return {
    success: true,
    user: {
      id: u.id,
      username: u.username,
      email: u.email,
      permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions,
      created_at: u.created_at,
      updated_at: u.updated_at,
    },
  };
}

async function updateUser(req, ctx) {
  if (!ctx.auth.checkPerm(req.user, 'admin:users:write')) {
    return { success: false, statusCode: 403, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } };
  }

  var existing = ctx.db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  var oldUser = existing.rows[0];
  var updates = {};
  if (req.body.username) updates.username = req.body.username;
  if (req.body.email) updates.email = req.body.email;
  if (req.body.permissions) updates.permissions = JSON.stringify(req.body.permissions);
  updates.updated_at = Date.now();

  var setClauses = Object.keys(updates).map(function(k) { return k + ' = ?'; });
  var setValues = Object.keys(updates).map(function(k) { return updates[k]; });
  setValues.push(req.params.id);

  ctx.db.query('UPDATE users SET ' + setClauses.join(', ') + ' WHERE id = ?', setValues);

  ctx.log.audit('user.update', req.user.id, { entityType: 'user', entityId: req.params.id, oldValue: { username: oldUser.username, email: oldUser.email }, newValue: updates });
  ctx.events.publish('user.updated', { userId: req.params.id, changes: updates });

  var result = ctx.db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  var u = result.rows[0];
  return {
    success: true,
    user: {
      id: u.id,
      username: u.username,
      email: u.email,
      permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions,
      created_at: u.created_at,
      updated_at: u.updated_at,
    },
  };
}

async function deleteUser(req, ctx) {
  if (!ctx.auth.checkPerm(req.user, 'admin:users:write')) {
    return { success: false, statusCode: 403, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } };
  }

  var existing = ctx.db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  ctx.auth.forceLogout(req.params.id, 'user_deleted');
  ctx.db.query('DELETE FROM users WHERE id = ?', [req.params.id]);

  ctx.log.audit('user.delete', req.user.id, { entityType: 'user', entityId: req.params.id, oldValue: { username: existing.rows[0].username } });
  ctx.events.publish('user.deleted', { userId: req.params.id });

  return { success: true, message: 'User deleted' };
}

async function changePassword(req, ctx) {
  var userId = req.params.id;
  var newPassword = req.body.newPassword;

  if (!newPassword || newPassword.length < 8) {
    return { success: false, statusCode: 400, error: { code: 'BAD_REQUEST', message: 'New password must be at least 8 characters' } };
  }

  var currentUserId = req.user.id;
  var isAdmin = ctx.auth.checkPerm(req.user, 'admin:users:write');

  if (userId !== currentUserId && !isAdmin) {
    return { success: false, statusCode: 403, error: { code: 'FORBIDDEN', message: 'Cannot change another user\'s password' } };
  }

  var existing = ctx.db.query('SELECT id FROM users WHERE id = ?', [userId]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  var hashedPassword = bcrypt.hashSync(newPassword, 10);
  ctx.db.query('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hashedPassword, Date.now(), userId]);

  ctx.log.audit('user.password_changed', currentUserId, { entityType: 'user', entityId: userId });
  ctx.events.publish('user.password_changed', { userId: userId });

  ctx.auth.forceLogout(userId, 'password_changed_force_logout');

  return { success: true, message: 'Password changed successfully. All active sessions have been terminated.' };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  login: login,
  logout: logout,
  getMe: getMe,
  forgotPassword: forgotPassword,
  resetPassword: resetPassword,
  listUsers: listUsers,
  createUser: createUser,
  getUser: getUser,
  updateUser: updateUser,
  deleteUser: deleteUser,
  changePassword: changePassword,
};