// example/public/components/Header.js
import { html } from 'https://esm.sh/htm/preact';

export function Header({
  activeTab,
  onSelectTab,
  user,
  onEditProfile,
  showStats,
  onToggleStats,
  onOpenViewerTab,
  activeMobileSubTab,
  onSelectMobileSubTab,
}) {
  const tabs = [
    { id: 'webrtc', label: 'WebRTC Live Stream', icon: 'videocam', badge: 'Main' },
    { id: 'presence', label: 'Presence Tracker', icon: 'groups' },
    { id: 'jwt', label: 'JWT Protected WS', icon: 'lock' },
    { id: 'rest', label: 'REST Inspector', icon: 'bolt' },
  ];

  return html`
    <header class="app-header responsive max mb-3">
      <!-- Top Navigation Bar -->
      <nav class="transparent p-0">
        <!-- Logo & Branding -->
        <div class="row items-center gap-2">
          <div class="header-logo-icon">
            <span style="font-size: 24px;">⚡</span>
          </div>
          <div>
            <h5 class="m-0 font-bold text-white tracking-tight text-base sm:text-lg">
              WsRouter <span class="chip small border text-blue-300 ml-1" style="font-size: 0.65rem; padding: 1px 6px;">v0.1.0</span>
            </h5>
            <div class="text-xs text-slate-400 hide-on-mobile">High-Performance WebSocket & HTTP Router for Deno</div>
          </div>
        </div>

        <div class="max"></div>

        <!-- Right Side Actions -->
        <div class="row items-center gap-2">
          ${activeTab === 'webrtc' && html`
            <button
              type="button"
              class="button border small round ${showStats ? 'fill amber text-black' : 'text-slate-300'}"
              onClick=${onToggleStats}
              title="Toggle WebRTC Diagnostics & ICE Stats"
            >
              <i class="material-symbols-outlined" style="font-size: 16px;">analytics</i>
              <span class="hide-on-mobile">Stats</span>
            </button>

            <button
              type="button"
              class="button border small round text-slate-300"
              onClick=${onOpenViewerTab}
              title="Open a new browser tab as a viewer to test multi-user P2P stream"
            >
              <i class="material-symbols-outlined" style="font-size: 16px;">open_in_new</i>
              <span class="hide-on-mobile">+ Viewer Tab</span>
            </button>
          `}

          <!-- User Profile Chip -->
          <button
            type="button"
            class="button border small round text-white"
            onClick=${onEditProfile}
            style="background: rgba(30, 41, 59, 0.7); border-color: #475569;"
            title="Click to edit your display name or avatar"
          >
            <span style="font-size: 16px; margin-right: 4px;">${user.avatar || '👤'}</span>
            <span class="bold text-xs">${user.name || 'Set Name'}</span>
          </button>
        </div>
      </nav>

      <!-- Navigation Tabs Strip -->
      <div class="row items-center gap-1 mt-2 pb-1 overflow-x-auto border-b border-slate-800">
        ${tabs.map(
          (t) => html`
            <button
              type="button"
              class="button small round ${activeTab === t.id ? 'fill primary' : 'transparent text-slate-300'}"
              onClick=${() => onSelectTab(t.id)}
              style="white-space: nowrap;"
            >
              <i class="material-symbols-outlined" style="font-size: 18px; margin-right: 4px;">${t.icon}</i>
              <span>${t.label}</span>
              ${t.badge && html`
                <span class="chip small fill red text-white ml-1" style="font-size: 0.6rem; padding: 0 4px;">
                  ${t.badge}
                </span>
              `}
            </button>
          `
        )}
      </div>

      <!-- Mobile Sub-Navigation for WebRTC -->
      ${activeTab === 'webrtc' && html`
        <div class="row items-center gap-1 mt-2 show-on-mobile">
          <button
            type="button"
            class="button small round flex-1 ${activeMobileSubTab === 'stream' ? 'fill primary' : 'border text-slate-300'}"
            onClick=${() => onSelectMobileSubTab('stream')}
          >
            <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">videocam</i>
            <span>Stream</span>
          </button>
          <button
            type="button"
            class="button small round flex-1 ${activeMobileSubTab === 'chat' ? 'fill primary' : 'border text-slate-300'}"
            onClick=${() => onSelectMobileSubTab('chat')}
          >
            <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">forum</i>
            <span>Chat</span>
          </button>
          <button
            type="button"
            class="button small round flex-1 ${activeMobileSubTab === 'users' ? 'fill primary' : 'border text-slate-300'}"
            onClick=${() => onSelectMobileSubTab('users')}
          >
            <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">people</i>
            <span>Online</span>
          </button>
        </div>
      `}
    </header>
  `;
}
