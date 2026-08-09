export class SSEClient {
  constructor() {
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = new Map();
    this.onConnectedCallback = null;
    this.onErrorCallback = null;
    this.currentToken = null;
  }

  connect(token) {
    this.currentToken = token;
    this.close();
    const url = `/api/stream/notifications?token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('[SSE] Connected');
      this.reconnectAttempts = 0;
      if (this.onConnectedCallback) this.onConnectedCallback();
    };

    this.eventSource.onerror = (err) => {
      console.error('[SSE] Error:', err);
      this.close();
      if (this.onErrorCallback) this.onErrorCallback(err);
      this.scheduleReconnect();
    };

    this.eventSource.addEventListener('connected', (event) => {
      console.log('[SSE] Server acknowledged:', event.data);
    });

    const eventTypes = [
      'notification.created',
      'auto_rules.analyzed',
      'auto_rules.status_changed',
      'snapshot.completed',
      'knowledge.archived'
    ];

    eventTypes.forEach((type) => {
      this.eventSource.addEventListener(type, (event) => {
        this.dispatch(type, event);
      });
    });
  }

  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
  }

  unsubscribe(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback);
    }
  }

  dispatch(eventType, event) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      data = event.data;
    }
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach((cb) => cb(data));
    }
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach((cb) => cb({ type: eventType, ...data }));
    }
  }

  setOnConnected(callback) {
    this.onConnectedCallback = callback;
  }

  setOnError(callback) {
    this.onErrorCallback = callback;
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnect attempts reached');
      return;
    }
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`[SSE] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      if (this.currentToken) {
        this.connect(this.currentToken);
      }
    }, delay);
  }

  close() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

let sseInstance = null;
export const getSSEClient = () => {
  if (!sseInstance) sseInstance = new SSEClient();
  return sseInstance;
};
