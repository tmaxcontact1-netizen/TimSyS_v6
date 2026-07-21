'use strict';

const db = require('./db');

const FLUSH_INTERVAL = parseInt(process.env.METRICS_FLUSH_INTERVAL, 10) || 60000; // 1 min

let flushTimer = null;

/**
 * In-memory metrics collection with periodic DB flush.
 * Not injected into module Context — used by platform HTTP layer.
 */
class MetricsCollector {
  constructor() {
    this.counters = new Map(); // key -> count
    this.histograms = new Map(); // key -> { count, sum, min, max }
    this.gauges = new Map(); // key -> value

    if (!flushTimer) {
      flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL);
      flushTimer.unref();
    }
  }

  _key(name, tags = {}) {
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return tagStr ? `${name}|${tagStr}` : name;
  }

  increment(name, tags = {}, amount = 1) {
    const key = this._key(name, tags);
    this.counters.set(key, (this.counters.get(key) || 0) + amount);
  }

  timing(name, durationMs, tags = {}) {
    const key = this._key(name, tags);
    const entry = this.histograms.get(key) || { count: 0, sum: 0, min: Infinity, max: 0 };
    entry.count++;
    entry.sum += durationMs;
    entry.min = Math.min(entry.min, durationMs);
    entry.max = Math.max(entry.max, durationMs);
    this.histograms.set(key, entry);
  }

  gauge(name, value, tags = {}) {
    const key = this._key(name, tags);
    this.gauges.set(key, value);
  }

  snapshot() {
    const counters = {};
    const histograms = {};
    const gauges = {};

    for (const [key, count] of this.counters) {
      counters[key] = count;
    }

    for (const [key, h] of this.histograms) {
      histograms[key] = {
        count: h.count,
        avg: h.count > 0 ? h.sum / h.count : 0,
        min: h.min === Infinity ? 0 : h.min,
        max: h.max,
        sum: h.sum,
      };
    }

    for (const [key, value] of this.gauges) {
      gauges[key] = value;
    }

    return { counters, histograms, gauges };
  }

  prometheusFormat() {
    const lines = [];
    const snap = this.snapshot();

    for (const [key, count] of Object.entries(snap.counters)) {
      const [name, tagStr] = key.split('|');
      const labels = tagStr ? `{${tagStr.replace(/,/g, ',')}}` : '';
      lines.push(`${name}${labels} ${count}`);
    }

    for (const [key, h] of Object.entries(snap.histograms)) {
      const [name, tagStr] = key.split('|');
      const labels = tagStr ? `{${tagStr.replace(/,/g, ',')}}` : '';
      lines.push(`${name}_count${labels} ${h.count}`);
      lines.push(`${name}_avg${labels} ${h.avg.toFixed(2)}`);
      lines.push(`${name}_min${labels} ${h.min}`);
      lines.push(`${name}_max${labels} ${h.max}`);
    }

    for (const [key, value] of Object.entries(snap.gauges)) {
      const [name, tagStr] = key.split('|');
      const labels = tagStr ? `{${tagStr.replace(/,/g, ',')}}` : '';
      lines.push(`${name}${labels} ${value}`);
    }

    return lines.join('\n');
  }

  flush() {
    const snap = this.snapshot();
    const ts = Date.now();

    try {
      db.transaction((tx) => {
        for (const [key, count] of Object.entries(snap.counters)) {
          const [name, tagStr] = key.split('|');
          tx.query(
            `INSERT INTO metrics (timestamp, metric_name, value, tags) VALUES (?, ?, ?, ?)`,
            [ts, name, count, tagStr || '']
          );
        }
        for (const [key, h] of Object.entries(snap.histograms)) {
          const [name, tagStr] = key.split('|');
          tx.query(
            `INSERT INTO metrics (timestamp, metric_name, value, tags) VALUES (?, ?, ?, ?)`,
            [ts, `${name}_avg`, h.avg, tagStr || '']
          );
        }
        for (const [key, value] of Object.entries(snap.gauges)) {
          const [name, tagStr] = key.split('|');
          tx.query(
            `INSERT INTO metrics (timestamp, metric_name, value, tags) VALUES (?, ?, ?, ?)`,
            [ts, name, value, tagStr || '']
          );
        }
      });
    } catch (err) {
      // Metrics flush failure is non-fatal — log and continue
      console.error('Metrics flush failed:', err.message);
    }
  }

  reset() {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

const metrics = new MetricsCollector();

module.exports = metrics;