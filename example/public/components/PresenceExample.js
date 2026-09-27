// example/public/components/PresenceExample.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import { buildWsUrl, buildApiUrl } from './config.js';

const ROOMS = ['general', 'engineering', 'lounge'];
const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', color: '#10b981', icon: '🟢' },
  { value: 'away', label: 'Away', color: '#f59e0b', icon: '🟡' },
  { value: 'busy', label: 'Busy / DND', color: '#ef4444', icon: '🔴' },
  { value: 'meeting', label: 'In Meeting', color: '#8b5cf6', icon: '🟣' },
];

export function PresenceExample({ user }) {
  const [currentRoom, setCurrentRoom] = useState('general');
  const [status, setStatus] = useState('online');
  const [customStatus, setCustomStatus] = useState('');
  const [users, setUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputChat, setInputChat] = useState('');
  const [apiResponse, setApiResponse] = useState(null);
  const [showApiModal, setShowApiModal] = useState(false);

  const wsRef = useRef(null);
  const chatScrollRef = useRef(null);
  const eventsScrollRef = useRef(null);

  const addEvent = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setEvents((prev) => [...prev.slice(-40), { text, time, type, id: Math.random() }]);
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (eventsScrollRef.current) {
      eventsScrollRef.current.scrollTop = eventsScrollRef.current.scrollHeight;
    }
  }, [events]);

  // Connect to presence WebSocket room
  useEffect(() => {
    let isCancelled = false;
    let reconnectTimer = null;
    let retryDelay = 2000;

    const connect = () => {
      if (isCancelled) return;
      const wsUrl = buildWsUrl(`/api/presence-chat/${currentRoom}?userId=${encodeURIComponent(user.userId)}&name=${encodeURIComponent(user.name)}&avatar=${encodeURIComponent(user.avatar)}&status=${encodeURIComponent(status)}&customStatus=${encodeURIComponent(customStatus)}`);

      addEvent(`Connecting to room #${currentRoom}...`, 'info');
      try {
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          retryDelay = 2000;
          setIsConnected(true);
          addEvent(`Connected to #${currentRoom}`, 'success');
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'presence_state') {
              setUsers(data.users || []);
              addEvent(`Received initial presence snapshot (${data.users?.length || 0} users)`, 'info');
              return;
            }

            if (data.type === 'presence_join') {
              setUsers((prev) => {
                const existing = prev.filter((u) => u.userId !== data.user.userId);
                return [...existing, data.user];
              });
              addEvent(`👋 ${data.user.data?.name || data.user.userId} joined #${currentRoom}`, 'join');
              return;
            }

            if (data.type === 'presence_leave') {
              setUsers((prev) => {
                const departing = prev.find((u) => u.userId === data.userId);
                if (departing) {
                  addEvent(`🚪 ${departing.data?.name || data.userId} left #${currentRoom}`, 'leave');
                }
                return prev.filter((u) => u.userId !== data.userId);
              });
              return;
            }

            if (data.type === 'presence_update') {
              setUsers((prev) =>
                prev.map((u) => {
                  if (u.userId === data.userId) {
                    addEvent(`🔄 ${u.data?.name || data.userId} is now ${data.data?.status || 'updated'}`, 'update');
                    return { ...u, data: { ...u.data, ...data.data } };
                  }
                  return u;
                })
              );
              return;
            }

            if (data.type === 'chat') {
              setChatMessages((prev) => [...prev, data]);
              return;
            }
          } catch {
            // ignore parse errors
          }
        };

        socket.onerror = () => {
          // Handled gracefully via onclose
        };

        socket.onclose = () => {
          setIsConnected(false);
          addEvent(`Disconnected from #${currentRoom}`, 'leave');
          if (!isCancelled) {
            reconnectTimer = setTimeout(connect, retryDelay);
            retryDelay = Math.min(retryDelay * 1.5, 10000);
          }
        };
      } catch {
        if (!isCancelled) {
          reconnectTimer = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 1.5, 10000);
        }
      }
    };

    connect();

    return () => {
      isCancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [currentRoom, user.userId, user.name, user.avatar]);

  // Update status handler
  const handleUpdateStatus = (newStatus, newCustom = customStatus) => {
    setStatus(newStatus);
    setCustomStatus(newCustom);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'update_presence',
          status: newStatus,
          customStatus: newCustom,
        })
      );
    }
  };

  const handleSendChat = (e) => {
    e?.preventDefault();
    const text = inputChat.trim();
    if (!text) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat',
          text,
        })
      );
    }
    setInputChat('');
  };

  const fetchRoomPresenceApi = async () => {
    try {
      const res = await fetch(buildApiUrl(`/api/presence/${currentRoom}`));
      const data = await res.json();
      setApiResponse({ endpoint: `/api/presence/${currentRoom}`, data });
      setShowApiModal(true);
    } catch (err) {
      setApiResponse({ endpoint: `/api/presence/${currentRoom}`, error: err.message });
      setShowApiModal(true);
    }
  };

  const fetchAllPresenceApi = async () => {
    try {
      const res = await fetch(buildApiUrl('/api/presence'));
      const data = await res.json();
      setApiResponse({ endpoint: '/api/presence', data });
      setShowApiModal(true);
    } catch (err) {
      setApiResponse({ endpoint: '/api/presence', error: err.message });
      setShowApiModal(true);
    }
  };

  return html`
    <div>
      <!-- Top Room Switcher & API Diagnostics Bar -->
      <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
        <div class="row items-center justify-between wrap gap-3">
          <!-- Room Tabs -->
          <div class="row items-center gap-2">
            <span class="bold text-xs uppercase text-slate-400">Select Room:</span>
            <div class="row gap-1">
              ${ROOMS.map(
                (r) => html`
                  <button
                    type="button"
                    class="button small round ${currentRoom === r ? 'fill primary' : 'border'}"
                    onClick=${() => setCurrentRoom(r)}
                  >
                    <span>#${r}</span>
                  </button>
                `
              )}
            </div>
          </div>

          <!-- REST API Buttons -->
          <div class="row items-center gap-2">
            <button
              type="button"
              class="button border small round text-white"
              onClick=${fetchRoomPresenceApi}
              title="Query active room presence via REST API"
            >
              <i class="material-symbols-outlined" style="font-size: 16px;">api</i>
              <span>GET /api/presence/${currentRoom}</span>
            </button>
            <button
              type="button"
              class="button border small round text-white"
              onClick=${fetchAllPresenceApi}
              title="Query global presence via REST API"
            >
              <i class="material-symbols-outlined" style="font-size: 16px;">public</i>
              <span>GET /api/presence</span>
            </button>
          </div>
        </div>
      </article>

      <!-- Main Layout -->
      <div class="grid">
        <!-- Left Column: Status Controller & Online Users List -->
        <div class="s12 m7 l7">
          <!-- Status Switcher Card -->
          <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
            <h6 class="m-0 font-bold text-white text-sm mb-2">My Live Status & Mood</h6>
            <div class="row wrap gap-2 items-center mb-3">
              ${STATUS_OPTIONS.map(
                (opt) => html`
                  <button
                    type="button"
                    class="button small round ${status === opt.value ? 'fill primary' : 'border'}"
                    style="border-color: ${opt.color};"
                    onClick=${() => handleUpdateStatus(opt.value)}
                  >
                    <span class="mr-1">${opt.icon}</span>
                    <span>${opt.label}</span>
                  </button>
                `
              )}
            </div>

            <!-- Custom status field -->
            <div class="field label border small m-0" style="background: rgba(15, 23, 42, 0.6);">
              <input
                type="text"
                value=${customStatus}
                onInput=${(e) => handleUpdateStatus(status, e.target.value)}
                placeholder="e.g. Coding WebRTC routers, reviewing PR, in sprint planning"
              />
              <label>Custom status message</label>
            </div>
          </article>

          <!-- Active Room Presence Grid -->
          <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-3">
              <div class="row items-center gap-2">
                <i class="material-symbols-outlined text-emerald-400" style="font-size: 20px;">group</i>
                <h6 class="m-0 font-bold text-white text-sm">Online Users in #${currentRoom}</h6>
              </div>
              <span class="chip small border bg-emerald-950 text-emerald-300">
                ${users.length} active
              </span>
            </div>

            <div class="grid small-space">
              ${users.length === 0 && html`
                <div class="s12 text-center p-4 text-slate-500 text-xs">
                  No users connected to this room.
                </div>
              `}

              ${users.map((u) => {
                const isMe = u.userId === user.userId;
                const statusObj = STATUS_OPTIONS.find((s) => s.value === u.data.status) || STATUS_OPTIONS[0];

                return html`
                  <div class="s12 m6">
                    <div class="p-3 rounded border" style="background: ${isMe ? 'rgba(37, 99, 235, 0.15)' : 'rgba(30, 41, 59, 0.6)'}; border-color: ${isMe ? 'rgba(59, 130, 246, 0.4)' : '#334155'};">
                      <div class="row items-start justify-between">
                        <div class="row items-center gap-2">
                          <span style="font-size: 24px;">${u.data.avatar || '👤'}</span>
                          <div>
                            <div class="row items-center gap-1">
                              <strong class="text-sm ${isMe ? 'text-blue-300' : 'text-slate-100'}">${u.data.name || u.userId}</strong>
                              ${isMe && html`<span class="text-slate-400 text-xs">(you)</span>`}
                            </div>
                            <div class="row items-center gap-1 mt-1">
                              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusObj.color}; display: inline-block;"></span>
                              <span class="text-xs text-slate-300">${statusObj.label}</span>
                            </div>
                          </div>
                        </div>

                        ${u.connections > 1 && html`
                          <span class="chip small border text-amber-300 bg-amber-950" style="font-size: 0.65rem;" title="${u.connections} open tabs for this user">
                            ${u.connections} tabs
                          </span>
                        `}
                      </div>

                      ${u.data.customStatus && html`
                        <div class="text-xs text-slate-400 mt-2 p-1 rounded bg-slate-900 border border-slate-800 italic">
                          "${u.data.customStatus}"
                        </div>
                      `}
                    </div>
                  </div>
                `;
              })}
            </div>
          </article>
        </div>

        <!-- Right Column: Room Chat & Real-Time Event Log -->
        <div class="s12 m5 l5">
          <!-- Room Chat -->
          <article class="round border surface p-3 mb-3 flex flex-col" style="background: #1e293b; color: #f8fafc; height: 320px;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <h6 class="m-0 font-bold text-white text-sm">Room Chat</h6>
              <span class="text-xs text-slate-400">${chatMessages.length} msgs</span>
            </div>

            <div class="max flex-1 overflow-y-auto mb-2 pr-1" ref=${chatScrollRef}>
              ${chatMessages.length === 0 && html`
                <div class="text-center p-4 text-slate-500 text-xs">Say hello to room #${currentRoom}!</div>
              `}
              ${chatMessages.map((msg, i) => html`
                <div key=${i} class="mb-2 p-2 rounded" style="background: rgba(15, 23, 42, 0.5);">
                  <div class="row items-center justify-between text-xs mb-1">
                    <strong class="text-blue-300">${msg.avatar || '👤'} ${msg.from}</strong>
                    <span class="text-slate-500">${new Date(msg.timestamp || Date.now()).toLocaleTimeString()}</span>
                  </div>
                  <div class="text-sm text-slate-200">${msg.text}</div>
                </div>
              `)}
            </div>

            <form onSubmit=${handleSendChat} class="row items-center gap-2">
              <div class="field label border small m-0 flex-1" style="background: rgba(15, 23, 42, 0.6);">
                <input
                  type="text"
                  value=${inputChat}
                  onInput=${(e) => setInputChat(e.target.value)}
                  placeholder="Type message..."
                />
                <label>Chat</label>
              </div>
              <button type="submit" class="button fill primary circle" style="width: 36px; height: 36px; padding: 0;">
                <i class="material-symbols-outlined" style="font-size: 16px;">send</i>
              </button>
            </form>
          </article>

          <!-- Live Event Diff Stream -->
          <article class="round border surface p-3" style="background: #0f172a; color: #f8fafc; border-color: #334155;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <div class="row items-center gap-2">
                <i class="material-symbols-outlined text-amber-400" style="font-size: 18px;">history</i>
                <h6 class="m-0 font-bold text-white text-sm">Presence Diffs & Events</h6>
              </div>
              <button class="button transparent circle small text-slate-400" onClick=${() => setEvents([])} title="Clear logs">
                <i class="material-symbols-outlined" style="font-size: 16px;">delete_sweep</i>
              </button>
            </div>

            <div class="overflow-y-auto font-mono text-xs" ref=${eventsScrollRef} style="max-height: 180px;">
              ${events.length === 0 && html`
                <div class="text-slate-500 p-2 text-center">Waiting for presence events...</div>
              `}
              ${events.map((ev) => html`
                <div key=${ev.id} class="p-1 mb-1 rounded" style="background: rgba(30, 41, 59, 0.5);">
                  <span class="text-slate-500 mr-2">[${ev.time}]</span>
                  <span class="text-slate-300">${ev.text}</span>
                </div>
              `)}
            </div>
          </article>
        </div>
      </div>

      <!-- REST API Modal -->
      ${showApiModal && apiResponse && html`
        <div
          class="modal-backdrop active"
          style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;"
        >
          <article class="round border surface p-4" style="max-width: 600px; width: 100%; background: #1e293b; color: #f8fafc;">
            <div class="row items-center justify-between mb-3">
              <strong class="text-sm text-blue-300">Response: ${apiResponse.endpoint}</strong>
              <button class="button circle transparent small text-slate-400" onClick=${() => setShowApiModal(false)}>
                <i class="material-symbols-outlined">close</i>
              </button>
            </div>
            <pre class="p-3 rounded bg-slate-900 overflow-x-auto text-xs text-emerald-400 font-mono" style="max-height: 300px;">
              ${JSON.stringify(apiResponse.data || apiResponse.error, null, 2)}
            </pre>
            <div class="row justify-end mt-3">
              <button class="button fill primary small" onClick=${() => setShowApiModal(false)}>Close</button>
            </div>
          </article>
        </div>
      `}
    </div>
  `;
}
