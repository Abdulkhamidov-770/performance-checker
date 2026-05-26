/**
 * WebSocket subscriber — jobId bo'yicha live log oqimi.
 * Auto-reconnect bilan: ulanish uzilsa, exponential backoff bilan qayta urinadi.
 */
import { ref, onUnmounted } from 'vue';

const RECONNECT_DELAYS = [500, 1000, 2000, 4000, 8000, 15000]; // ms
const MAX_RECONNECT_ATTEMPTS = 10;

export function useJobSocket(jobId) {
  const logs = ref([]);
  const status = ref('running');
  const exitCode = ref(null);
  const summary = ref(null);
  const connected = ref(false);
  const error = ref(null);
  const reconnecting = ref(false);
  const reconnectAttempt = ref(0);

  let socket = null;
  let reconnectTimer = null;
  let manuallyClosed = false;

  function connect() {
    if (manuallyClosed) return;
    const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/jobs/${jobId}`;
    socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => {
      connected.value = true;
      reconnecting.value = false;
      reconnectAttempt.value = 0;
      error.value = null;
    });

    socket.addEventListener('close', () => {
      connected.value = false;
      // Job tugagan bo'lsa reconnect kerakmas
      if (manuallyClosed || status.value === 'completed'
          || status.value === 'failed' || status.value === 'cancelled') {
        return;
      }
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      error.value = 'Ulanish xato';
    });

    socket.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'log') {
          logs.value.push({ stream: msg.stream, text: msg.text, ts: msg.ts });
          if (logs.value.length > 10000) logs.value.shift();
        } else if (msg.type === 'status') {
          status.value = msg.status;
          exitCode.value = msg.exitCode;
          if (msg.summary) summary.value = msg.summary;
        } else if (msg.type === 'error') {
          error.value = msg.message;
        }
      } catch {}
    });
  }

  function scheduleReconnect() {
    if (reconnectAttempt.value >= MAX_RECONNECT_ATTEMPTS) {
      error.value = `Ulanish qayta tiklanmadi (${MAX_RECONNECT_ATTEMPTS} marta urindi)`;
      return;
    }
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt.value, RECONNECT_DELAYS.length - 1)];
    reconnecting.value = true;
    reconnectAttempt.value++;
    reconnectTimer = setTimeout(connect, delay);
  }

  function close() {
    manuallyClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try { socket?.close(); } catch {}
  }

  connect();
  onUnmounted(close);

  return {
    logs, status, exitCode, summary, connected, error,
    reconnecting, reconnectAttempt, close,
  };
}
