'use strict';

const crypto = require('crypto');
const db = require('./db');

const SESSION_TTL = parseInt(process.env.SESSION_TTL, 10) || 86400; // 24h
const CLEANUP_INTERVAL = parseInt(process.env.SESSION_CLEANUP_INTERVAL, 10) || 300000; // 5 min

let cleanupTimer = null;

/**
 * Internal session store backed by SQLite.
 * Used by auth.js — not injected into module Context.
 */
class SessionStore {
  constructor() {
    if (!cleanupTimer) {
      cleanupTimer = setInterval(() => this.cleanupExpired(), CLEANUP_INTERVAL);
      cleanupTimer.unref();
    }
  }

  create(userId, payload = {}) {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + SESSION_TTL * 1000;

    db.query(
      `INSERT INTO sessions (session_id, user_id, created_at, expires_at, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, userId, now, expiresAt, JSON.stringify(payload)]
    );

    return {
      sessionId,
      userId,
      payload,
      createdAt: now,
      expiresAt,
    };
  }

  get(sessionId) {
    const result = db.query(
      `SELECT session_id, user_id, created_at, expires_at, payload
       FROM sessions WHERE session_id = ?`,
      [sessionId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    if (Date.now() > row.expires_at) {
      this.destroy(sessionId);
      return null;
    }

    return {
      sessionId: row.session_id,
      userId: row.user_id,
      payload: JSON.parse(row.payload),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  destroy(sessionId) {
    db.query(`DELETE FROM sessions WHERE session_id = ?`, [sessionId]);
  }

  destroyByUser(userId, reason = null) {
    const count = db.query(
      `DELETE FROM sessions WHERE user_id = ?`,
      [userId]
    );
    return count.changes;
  }

  listActiveByUser(userId) {
    const result = db.query(
      `SELECT session_id, user_id, created_at, expires_at, payload
       FROM sessions
       WHERE user_id = ? AND expires_at > ?`,
      [userId, Date.now()]
    );

    return result.rows.map((row) => ({
      sessionId: row.session_id,
      userId: row.user_id,
      payload: JSON.parse(row.payload),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
  }

  rotate(sessionId) {
    const session = this.get(sessionId);
    if (!session) throw new Error(`Cannot rotate: session ${sessionId} not found`);

    this.destroy(sessionId);
    return this.create(session.userId, session.payload);
  }

  cleanupExpired() {
    db.query(`DELETE FROM sessions WHERE expires_at <= ?`, [Date.now()]);
  }
}

const sessionStore = new SessionStore();

module.exports = sessionStore;