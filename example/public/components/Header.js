// example/public/components/Header.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { subscribeBackendHealth, isHostedOnDenoServer } from './config.js';

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
  onOpenSettings,
  isCustomBackend,
}) {
  const [health, setHealth] = useState({ isChecking: false, isOnline: false });

  useEffect(() => {
    const unsubscribe = subscribeBackendHealth((status) => {
      setHealth(status);
    });
    return unsubscribe;
  }, []);

  const tabs = [
    { id: 'webrtc', label: 'WebRTC Live Stream', icon: 'videocam', badge: 'Main' },
    { id: 'presence', label: 'Presence Tracker', icon: 'groups' },
    { id: 'jwt', label: 'JWT Protected WS', icon: 'lock' },
    { id: 'rest', label: 'REST Inspector', icon: 'bolt' },
  ];

  return html`
    <header class="app-header responsive max mb-3">
      <!-- Top Navigation Bar -->
      <nav class="transparent p-0" style="flex-wrap: wrap; gap: 8px 12px; max-width: 100%; width: 100%; justify-content: space-between; align-items: center;">
        <!-- Logo & Branding -->
        <div class="row items-center gap-2" style="max-width: 100%;">
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

        <div class="max" style="min-width: 8px;"></div>

        <!-- Right Side Actions (Targeted by Focus Mode) -->
        <div class="row items-center gap-1.5 sm:gap-2" style="flex-wrap: wrap; justify-content: flex-end; max-width: 100%;">
          ${activeTab === 'webrtc' && html`
            <button
              type="button"
              class="button border small round ${showStats ? 'fill amber text-black' : 'text-slate-300'}"
              onClick=${onToggleStats}
              title="Toggle WebRTC Diagnostics & ICE Stats"
              style="padding: 0 8px; height: 32px;"
            >
              <i class="material-symbols-outlined" style="font-size: 16px;">analytics</i>
              <span class="hide-on-mobile">Stats</span>
            </button>

            <button
              type="button"
              class="button border small round text-slate-300"
              onClick=${onOpenViewerTab}
              title="Open a new browser tab as a viewer to test multi-user P2P stream"
              style="padding: 0 8px; height: 32px;"
            >
              <i class="material-symbols-outlined" style="font-size: 16px;">open_in_new</i>
              <span class="hide-on-mobile">+ Viewer Tab</span>
            </button>
          `}

          <!-- Server / Endpoint Settings Button with Heartbeat Status -->
          <button
            type="button"
            class="button border small round ${isCustomBackend ? 'fill blue-900 text-blue-200' : 'text-slate-300'}"
            onClick=${onOpenSettings}
            title=${health.isOnline ? `Backend Online (${health.latencyMs}ms)` : health.isChecking ? 'Checking backend heartbeat...' : 'Backend unreachable / offline'}
            style="position: relative; padding: 0 8px; height: 32px;"
          >
            <span
              class="live-dot-indicator ${health.isOnline ? 'live' : 'offline'}"
              style="width: 8px; height: 8px; margin-right: 4px; background-color: ${health.isOnline ? '#10b981' : health.isChecking ? '#f59e0b' : '#ef4444'}; box-shadow: 0 0 6px ${health.isOnline ? '#10b981' : health.isChecking ? '#f59e0b' : '#ef4444'};"
            ></span>
            <i class="material-symbols-outlined" style="font-size: 15px;">dns</i>
            <span class="hide-on-mobile">${isCustomBackend ? 'Custom' : 'Server'}</span>
          </button>

          <!-- User Profile Chip -->
          <button
            type="button"
            class="button border small round text-white"
            onClick=${onEditProfile}
            style="background: rgba(30, 41, 59, 0.7); border-color: #475569; padding: 0 8px; height: 32px; max-width: 140px;"
            title="Click to edit your display name or avatar"
          >
            <span style="font-size: 15px; margin-right: 4px;">${user.avatar || '👤'}</span>
            <span class="bold text-xs" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75px;">${user.name || 'Set Name'}</span>
          </button>
        </div>
      </nav>

      <!-- Navigation Tabs Strip (Targeted by Focus Mode) -->
      <div class="row items-center gap-1.5 mt-2 pb-1 border-b border-slate-800" style="flex-wrap: wrap; width: 100%; max-width: 100%;">
        ${tabs.map(
          (t) => html`
            <button
              type="button"
              class="button small round ${activeTab === t.id ? 'fill primary' : 'transparent text-slate-300'}"
              onClick=${() => onSelectTab(t.id)}
              style="white-space: nowrap; max-width: 100%; font-size: 0.8rem; padding: 0 10px; height: 32px;"
            >
              <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">${t.icon}</i>
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
        <div class="row items-center gap-1.5 mt-2 show-on-mobile" style="width: 100%; max-width: 100%; flex-wrap: wrap; box-sizing: border-box;">
          <button
            type="button"
            class="button small round flex-1 ${activeMobileSubTab === 'stream' ? 'fill primary' : 'border text-slate-300'}"
            onClick=${() => onSelectMobileSubTab('stream')}
            style="min-width: 0; padding: 0 6px; height: 32px; font-size: 0.8rem;"
          >
            <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">videocam</i>
            <span>Stream</span>
          </button>
          <button
            type="button"
            class="button small round flex-1 ${activeMobileSubTab === 'chat' ? 'fill primary' : 'border text-slate-300'}"
            onClick=${() => onSelectMobileSubTab('chat')}
            style="min-width: 0; padding: 0 6px; height: 32px; font-size: 0.8rem;"
          >
            <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">forum</i>
            <span>Chat</span>
          </button>
          <button
            type="button"
            class="button small round flex-1 ${activeMobileSubTab === 'users' ? 'fill primary' : 'border text-slate-300'}"
            onClick=${() => onSelectMobileSubTab('users')}
            style="min-width: 0; padding: 0 6px; height: 32px; font-size: 0.8rem;"
          >
            <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">people</i>
            <span>Online</span>
          </button>
        </div>
      `}
    </header>
  `;
}
