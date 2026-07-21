'use strict';

const analyzer = require('./analyzer');
const db = require('../../shared/services/db');
const crypto = require('crypto');

class RecommendationEngine {
  getSuggestions(intent) {
    return analyzer.analyze(intent);
  }

  persist(suggestions) {
    var id = crypto.randomUUID();
    var now = Date.now();
    db.query(
      'INSERT INTO recommendations (id, suggestions_data, generated_at, expires_at) VALUES (?, ?, ?, ?)',
      [id, JSON.stringify(suggestions), now, now + 3600000]
    );
    return id;
  }

  getStored(recId) {
    var result = db.query('SELECT * FROM recommendations WHERE id = ?', [recId]);
    if (result.rows.length === 0) return null;
    var row = result.rows[0];
    return {
      id: row.id,
      suggestions: typeof row.suggestions_data === 'string' ? JSON.parse(row.suggestions_data) : row.suggestions_data,
      generatedAt: row.generated_at,
      expiresAt: row.expires_at
    };
  }

  cleanup() {
    var now = Date.now();
    db.query('DELETE FROM recommendations WHERE expires_at IS NOT NULL AND expires_at <= ?', [now]);
  }
}

const engine = new RecommendationEngine();
module.exports = engine;
