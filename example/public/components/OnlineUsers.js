// example/public/components/OnlineUsers.js
import { html } from 'https://esm.sh/htm/preact';

export function OnlineUsers({ users, currentUserId, isLive, broadcasterId }) {
  const broadcasters = users.filter((u) => u.data.role === 'broadcaster' || (isLive && u.userId === broadcasterId));
  const viewers = users.filter((u) => u.data.role !== 'broadcaster' && (!isLive || u.userId !== broadcasterId));

  return html`
    <article class="round border surface p-3 flex flex-col" style="background: #1e293b; color: #f8fafc; height: 100%;">
      <!-- Header -->
      <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
        <div class="row items-center gap-2">
          <i class="material-symbols-outlined text-emerald-400" style="font-size: 20px;">people</i>
          <h6 class="m-0 font-bold text-white text-sm">Who is Online</h6>
        </div>
        <span class="chip small border bg-emerald-950 text-emerald-300" style="font-size: 0.7rem; padding: 2px 8px;">
          ${users.length} connected
        </span>
      </div>

      <!-- Users List -->
      <div class="users-scroll-container max flex-1 overflow-y-auto pr-1" style="min-height: 180px; max-height: 380px;">
        ${users.length === 0 && html`
          <div class="text-center p-3 text-slate-500 text-xs">
            No other users connected.
          </div>
        `}

        <!-- Broadcaster Section (if any) -->
        ${broadcasters.length > 0 && html`
          <div class="text-xs uppercase text-slate-400 font-bold mb-1 tracking-wider">🎥 Streamer (${broadcasters.length})</div>
          ${broadcasters.map((u) => {
            const isMe = u.userId === currentUserId;
            return html`
              <div key=${u.userId} class="row items-center justify-between p-2 rounded mb-1" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3);">
                <div class="row items-center gap-2">
                  <span style="font-size: 20px;">${u.data.avatar || '👤'}</span>
                  <div>
                    <div class="row items-center gap-1">
                      <span class="bold text-sm text-red-200">${u.data.name || u.userId}</span>
                      ${isMe && html`<span class="text-slate-400 text-xs">(you)</span>`}
                    </div>
                    <div class="text-xs text-red-400">Broadcasting live</div>
                  </div>
                </div>
                <div class="row items-center gap-1">
                  ${u.connections > 1 && html`
                    <span class="chip small border" style="font-size: 0.65rem;" title="${u.connections} open tabs/devices">
                      ${u.connections} tabs
                    </span>
                  `}
                  <span class="chip small fill red text-white" style="font-size: 0.65rem; padding: 1px 6px;">
                    LIVE
                  </span>
                </div>
              </div>
            `;
          })}
        `}

        <!-- Viewers Section -->
        <div class="text-xs uppercase text-slate-400 font-bold mt-2 mb-1 tracking-wider">👁️ Viewers (${viewers.length})</div>
        ${viewers.length === 0 && html`
          <div class="text-xs text-slate-500 italic p-2">No viewers currently watching.</div>
        `}
        ${viewers.map((u) => {
          const isMe = u.userId === currentUserId;
          return html`
            <div key=${u.userId} class="row items-center justify-between p-2 rounded mb-1" style="background: ${isMe ? 'rgba(59, 130, 246, 0.15)' : 'rgba(51, 65, 85, 0.25)'}; border: 1px solid ${isMe ? 'rgba(59, 130, 246, 0.3)' : 'rgba(71, 85, 105, 0.2)'};">
              <div class="row items-center gap-2">
                <span style="font-size: 18px;">${u.data.avatar || '👤'}</span>
                <div>
                  <div class="row items-center gap-1">
                    <span class="text-sm ${isMe ? 'bold text-blue-300' : 'text-slate-200'}">${u.data.name || u.userId}</span>
                    ${isMe && html`<span class="text-slate-400 text-xs">(you)</span>`}
                  </div>
                  <div class="text-xs text-slate-400">Viewer</div>
                </div>
              </div>
              <div class="row items-center gap-1">
                ${u.connections > 1 && html`
                  <span class="chip small border" style="font-size: 0.65rem;" title="${u.connections} open tabs">
                    ${u.connections} tabs
                  </span>
                `}
                <span class="status-dot-green" style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              </div>
            </div>
          `;
        })}
      </div>
    </article>
  `;
}
