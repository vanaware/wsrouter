// example/public/components/StreamStats.js
import { html } from 'https://esm.sh/htm/preact';

export function StreamStats({ stats, room, user, isBroadcasting, isLive, onClose }) {
  return html`
    <article class="round border surface p-3 mb-3" style="background: #0f172a; border-color: #334155; color: #f8fafc;">
      <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
        <div class="row items-center gap-2">
          <i class="material-symbols-outlined text-amber-400" style="font-size: 18px;">analytics</i>
          <strong class="text-sm">WebRTC & Connection Diagnostics</strong>
        </div>
        <button class="button circle transparent small text-slate-400" onClick=${onClose}>
          <i class="material-symbols-outlined" style="font-size: 16px;">close</i>
        </button>
      </div>

      <div class="grid small-space text-xs">
        <div class="s6 m3">
          <div class="p-2 rounded bg-slate-800">
            <span class="text-slate-400 block">Signaling WS</span>
            <span class="bold ${stats.wsConnected ? 'text-emerald-400' : 'text-red-400'}">
              ${stats.wsConnected ? 'Connected (WSS)' : 'Disconnected'}
            </span>
          </div>
        </div>
        <div class="s6 m3">
          <div class="p-2 rounded bg-slate-800">
            <span class="text-slate-400 block">P2P ICE State</span>
            <span class="bold text-blue-400">${stats.iceState || 'new / idle'}</span>
          </div>
        </div>
        <div class="s6 m3">
          <div class="p-2 rounded bg-slate-800">
            <span class="text-slate-400 block">Active Peer Links</span>
            <span class="bold text-amber-400">${stats.peerCount || 0} peers</span>
          </div>
        </div>
        <div class="s6 m3">
          <div class="p-2 rounded bg-slate-800">
            <span class="text-slate-400 block">Room ID</span>
            <span class="bold text-slate-200">#${room}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}
