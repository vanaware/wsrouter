// example/public/components/JwtExample.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useRef, useEffect } from 'https://esm.sh/preact/hooks';

export function JwtExample() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123');
  const [token, setToken] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [room, setRoom] = useState('secure-channel');
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [logs, setLogs] = useState([]);
  const [authError, setAuthError] = useState('');

  const wsRef = useRef(null);
  const logScrollRef = useRef(null);
  const msgScrollRef = useRef(null);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-50), { text: msg, time, type, id: Math.random() }]);
  };

  useEffect(() => {
    if (logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (msgScrollRef.current) msgScrollRef.current.scrollTop = msgScrollRef.current.scrollHeight;
  }, [messages]);

  // Step 1: POST /api/login
  const handleLogin = async (e) => {
    e?.preventDefault();
    setAuthError('');
    addLog(`POST /api/login (user: ${username})...`, 'info');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.success && data.token) {
        setToken(data.token);
        setUserProfile(data.user);
        addLog(`✅ JWT Token Acquired (HS256 signed)`, 'success');
      } else {
        setAuthError(data.error || 'Authentication failed');
        addLog(`❌ Login Error: ${data.error}`, 'error');
      }
    } catch (err) {
      setAuthError(err.message);
      addLog(`❌ Network Error: ${err.message}`, 'error');
    }
  };

  // Step 2: Connect WebSocket with Bearer subprotocol
  const handleConnectWs = (customToken = token) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/jwt-chat/${room}`;
    addLog(`Connecting WebSocket with subprotocol Bearer to ${wsUrl}...`, 'info');

    try {
      const socket = new WebSocket(wsUrl, ['Bearer', customToken]);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsWsConnected(true);
        addLog(`🟢 WebSocket Connected & Subprotocol Authenticated!`, 'success');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'auth_success') {
            addLog(`🛡️ Server: ${data.message}`, 'success');
            return;
          }
          if (data.type === 'error') {
            addLog(`⚠️ Server Error: ${data.error}`, 'error');
            return;
          }
          if (data.type === 'chat') {
            setMessages((prev) => [...prev, data]);
            addLog(`📨 Message from ${data.from}: ${data.text}`, 'info');
          }
        } catch {
          addLog(`📨 Raw message: ${event.data}`, 'info');
        }
      };

      socket.onclose = (event) => {
        setIsWsConnected(false);
        addLog(`🔴 WebSocket Closed (Code: ${event.code}, Reason: ${event.reason || 'Normal'})`, event.code === 1008 ? 'error' : 'info');
      };

      socket.onerror = () => {
        addLog(`⚠️ WebSocket error encountered`, 'error');
      };
    } catch (err) {
      addLog(`❌ Failed to instantiate WebSocket: ${err.message}`, 'error');
    }
  };

  const handleSendMessage = (e) => {
    e?.preventDefault();
    const text = inputMsg.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({ type: 'chat', text }));
    setInputMsg('');
  };

  const handleTestTamper = () => {
    addLog(`🧪 Testing connection with TAMPERED / INVALID token...`, 'warning');
    handleConnectWs('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.INVALID_PAYLOAD_TAMPERED.SIGNATURE');
  };

  const handleTestMissingToken = () => {
    addLog(`🧪 Testing connection WITHOUT token...`, 'warning');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/jwt-chat/${room}`;
    const socket = new WebSocket(wsUrl);
    socket.onclose = (ev) => {
      addLog(`🔴 Correctly rejected: Code ${ev.code} (${ev.reason})`, 'error');
    };
  };

  return html`
    <div>
      <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
        <div class="row items-center gap-2">
          <i class="material-symbols-outlined text-amber-400" style="font-size: 24px;">lock</i>
          <div>
            <h5 class="m-0 font-bold text-white text-base">JWT Authentication & Protected WebSocket</h5>
            <p class="text-xs text-slate-400 m-0">
              Demonstrates token issuance (POST /api/login) and handshake authentication via <code class="text-amber-300">Sec-WebSocket-Protocol: Bearer, &lt;token&gt;</code>.
            </p>
          </div>
        </div>
      </article>

      <div class="grid">
        <!-- Step 1 & Step 2 Controllers -->
        <div class="s12 m6 l5">
          <!-- Step 1: Login Card -->
          <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <strong class="text-sm text-blue-300">1. Authenticate (POST /api/login)</strong>
              <span class="chip small border bg-blue-950 text-blue-200" style="font-size: 0.65rem;">Step 1</span>
            </div>

            <form onSubmit=${handleLogin}>
              <div class="grid small-space mb-2">
                <div class="s6">
                  <div class="field label border small m-0" style="background: rgba(15, 23, 42, 0.6);">
                    <input
                      type="text"
                      value=${username}
                      onInput=${(e) => setUsername(e.target.value)}
                      placeholder="admin or demo"
                      required
                    />
                    <label>Username</label>
                  </div>
                </div>
                <div class="s6">
                  <div class="field label border small m-0" style="background: rgba(15, 23, 42, 0.6);">
                    <input
                      type="password"
                      value=${password}
                      onInput=${(e) => setPassword(e.target.value)}
                      placeholder="123"
                      required
                    />
                    <label>Password (123)</label>
                  </div>
                </div>
              </div>

              ${authError && html`
                <div class="chip small border red text-white mb-2" style="width: 100%;">
                  ${authError}
                </div>
              `}

              <div class="row items-center justify-between">
                <button type="submit" class="button fill primary small round">
                  <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">key</i>
                  <span>Get JWT Token</span>
                </button>
                <span class="text-xs text-slate-400">Demo: admin / 123</span>
              </div>
            </form>

            ${token && html`
              <div class="mt-3 p-2 rounded bg-slate-900 border border-slate-700">
                <div class="row items-center justify-between text-xs mb-1">
                  <span class="text-emerald-400 font-bold">✓ Signed Token (HS256)</span>
                  <span class="text-slate-400">Role: ${userProfile?.role}</span>
                </div>
                <div class="font-mono text-xs text-slate-300 break-all" style="max-height: 50px; overflow-y: auto;">
                  ${token}
                </div>
              </div>
            `}
          </article>

          <!-- Step 2: Connect WebSocket Card -->
          <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <strong class="text-sm text-emerald-300">2. WebSocket Subprotocol Handshake</strong>
              <span class="chip small border bg-emerald-950 text-emerald-200" style="font-size: 0.65rem;">Step 2</span>
            </div>

            <div class="field label border small mb-2" style="background: rgba(15, 23, 42, 0.6);">
              <input
                type="text"
                value=${room}
                onInput=${(e) => setRoom(e.target.value)}
                placeholder="secure-channel"
              />
              <label>Room Name</label>
            </div>

            <div class="row wrap gap-2 mb-3">
              <button
                type="button"
                class="button fill ${isWsConnected ? 'green' : 'primary'} small round"
                onClick=${() => handleConnectWs(token)}
                disabled=${!token}
              >
                <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">
                  ${isWsConnected ? 'check_circle' : 'cable'}
                </i>
                <span>${isWsConnected ? 'Connected (Authenticated)' : 'Connect with Token'}</span>
              </button>

              ${isWsConnected && html`
                <button
                  type="button"
                  class="button border red small round"
                  onClick=${() => wsRef.current?.close()}
                >
                  Disconnect
                </button>
              `}
            </div>

            <!-- Security Tests / Tampering Tools -->
            <div class="pt-2 border-t border-slate-700">
              <span class="text-xs text-slate-400 bold block mb-1">🛡️ Security Verification Tests:</span>
              <div class="row gap-2">
                <button
                  type="button"
                  class="button border text-amber-300 small round"
                  onClick=${handleTestTamper}
                  title="Test server rejection on forged JWT"
                >
                  <span>Test Forged Token</span>
                </button>
                <button
                  type="button"
                  class="button border text-red-300 small round"
                  onClick=${handleTestMissingToken}
                  title="Test server rejection without token"
                >
                  <span>Test No Token</span>
                </button>
              </div>
            </div>
          </article>
        </div>

        <!-- Authenticated Chat & Live Logs -->
        <div class="s12 m6 l7">
          <!-- Chat Box -->
          <article class="round border surface p-3 mb-3 flex flex-col" style="background: #1e293b; color: #f8fafc; height: 260px;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <div class="row items-center gap-2">
                <i class="material-symbols-outlined text-blue-400" style="font-size: 18px;">lock</i>
                <strong class="text-sm">Protected Channel (#${room})</strong>
              </div>
              <span class="chip small border ${isWsConnected ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}">
                ${isWsConnected ? 'Authorized' : 'Disconnected'}
              </span>
            </div>

            <div class="max flex-1 overflow-y-auto mb-2 pr-1" ref=${msgScrollRef}>
              ${messages.length === 0 && html`
                <div class="text-center p-3 text-slate-500 text-xs">
                  ${isWsConnected ? 'Authenticated session ready. Type a message!' : 'Connect to send and receive secure messages.'}
                </div>
              `}
              ${messages.map((m, idx) => html`
                <div key=${idx} class="p-2 mb-1 rounded" style="background: rgba(15, 23, 42, 0.6);">
                  <div class="row items-center justify-between text-xs mb-1">
                    <strong class="text-blue-300">${m.avatar} ${m.from} (${m.role})</strong>
                    <span class="text-slate-500">${new Date(m.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div class="text-sm text-slate-100">${m.text}</div>
                </div>
              `)}
            </div>

            <form onSubmit=${handleSendMessage} class="row items-center gap-2">
              <div class="field label border small m-0 flex-1" style="background: rgba(15, 23, 42, 0.6);">
                <input
                  type="text"
                  value=${inputMsg}
                  onInput=${(e) => setInputMsg(e.target.value)}
                  placeholder="Type secure message..."
                  disabled=${!isWsConnected}
                />
                <label>Secure Message</label>
              </div>
              <button
                type="submit"
                class="button fill primary circle"
                style="width: 36px; height: 36px; padding: 0;"
                disabled=${!isWsConnected}
              >
                <i class="material-symbols-outlined" style="font-size: 16px;">send</i>
              </button>
            </form>
          </article>

          <!-- Audit & Protocol Log -->
          <article class="round border surface p-3" style="background: #0f172a; color: #f8fafc; border-color: #334155;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <strong class="text-xs text-amber-400 font-mono">PROTOCOL & SECURITY LOGS</strong>
              <button class="button transparent circle small text-slate-400" onClick=${() => setLogs([])}>
                <i class="material-symbols-outlined" style="font-size: 16px;">delete_sweep</i>
              </button>
            </div>
            <div class="font-mono text-xs overflow-y-auto" ref=${logScrollRef} style="max-height: 140px;">
              ${logs.length === 0 && html`<div class="text-slate-500">Ready. Authenticate or connect above.</div>`}
              ${logs.map((l) => html`
                <div key=${l.id} class="p-1 mb-1 rounded" style="background: rgba(30, 41, 59, 0.4);">
                  <span class="text-slate-500 mr-2">[${l.time}]</span>
                  <span class="${l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-emerald-400' : l.type === 'warning' ? 'text-amber-400' : 'text-slate-300'}">
                    ${l.text}
                  </span>
                </div>
              `)}
            </div>
          </article>
        </div>
      </div>
    </div>
  `;
}
