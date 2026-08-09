const log = require('./log');
const events = require('./events');

// Map<response, Set<channels>> — must be iterable (WeakMap is not)
const clients = new Map();
let heartbeatInterval = null;

async function initSSE() {
  heartbeatInterval = setInterval(() => {
    clients.forEach((channels, res) => {
      try {
        if (!res.writableEnded) {
          res.write(': ping\n\n');
        } else {
          closeClient(res);
        }
      } catch (err) {
        closeClient(res);
      }
    });
  }, 30000);
  log.info('SSE initialized', { interval: 30000 });
}

function registerClient(res, channels = ['*']) {
  const channelSet = new Set(channels);
  clients.set(res, channelSet);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  log.info('SSE client registered', { channels });
}

function closeClient(res) {
  clients.delete(res);
  if (!res.writableEnded) {
    try { res.end(); } catch (err) {}
  }
  log.debug('SSE client closed');
}

function broadcast(event, data) {
  const json = JSON.stringify(data);
  const payload = `event: ${event}\ndata: ${json}\n\n`;
  const deadClients = [];

  clients.forEach((channels, res) => {
    const matchWildcard = channels.has('*');
    const channelMatch = channels.has(event);

    // Check if any channel pattern matches (e.g. 'notification.*' matches 'notification.created')
    const patternMatch = [...channels].some(ch => {
      if (ch.endsWith('.*')) {
        return event.startsWith(ch.slice(0, -1));
      }
      return false;
    });

    if (!matchWildcard && !channelMatch && !patternMatch) return;

    try {
      if (!res.writableEnded) {
        res.write(payload);
      } else {
        deadClients.push(res);
      }
    } catch (err) {
      log.warn('SSE broadcast failed', { error: err.message });
      deadClients.push(res);
    }
  });

  deadClients.forEach(closeClient);
  log.debug('SSE broadcast', { event, clientCount: clients.size });
}

function subscribeToChannel(channel) {
  const handler = (payload) => {
    broadcast(channel, payload);
  };
  events.subscribe(channel, handler);
  log.info('SSE subscribed to channel', { channel });
  return () => events.unsubscribe(channel, handler);
}

function shutdown() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  const clientCount = clients.size;
  clients.clear();
  log.info('SSE shutdown', { clientsDisconnected: clientCount });
}

module.exports = {
  initSSE,
  registerClient,
  closeClient,
  broadcast,
  subscribeToChannel,
  shutdown,
  getClientCount: () => clients.size
};
