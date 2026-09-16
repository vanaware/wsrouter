// example/public/components/ServerSettingsModal.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import {
  getCustomBackend,
  setCustomBackend,
  isGitHubPages,
  isHostedOnDenoServer,
  getBackendHttpOrigin,
  getBackendWsOrigin,
  checkBackendHealth,
  subscribeBackendHealth,
  DEFAULT_REMOTE_BACKEND,
} from './config.js';

export function ServerSettingsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const [backendUrl, setBackendUrlState] = useState(getCustomBackend());
  const [saveStatus, setSaveStatus] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [healthInfo, setHealthInfo] = useState({ isChecking: false, isOnline: false, latencyMs: null });
  const [showOverrideForm, setShowOverrideForm] = useState(!isHostedOnDenoServer() || Boolean(getCustomBackend()));

  // Subscribe to live heartbeat diagnostics
  useEffect(() => {
    const unsubscribe = subscribeBackendHealth((status) => {
      setHealthInfo(status);
    });
    // Trigger a fresh probe when modal opens
    checkBackendHealth().catch(() => {});
    return unsubscribe;
  }, [isOpen]);

  const handleCopy = (text, label) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopyFeedback(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopyFeedback(''), 2500);
  };

  const handleSave = (e) => {
    e?.preventDefault();
    setCustomBackend(backendUrl);
    setSaveStatus('Settings saved! Testing connection and reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const handleReset = () => {
    setBackendUrlState('');
    setCustomBackend('');
    setSaveStatus('Reset to default origin! Reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const currentHttp = getBackendHttpOrigin();
  const currentWs = getBackendWsOrigin();
  const isDenoHost = isHostedOnDenoServer() && !getCustomBackend();
  const configJsSnippet = `export const DEFAULT_REMOTE_BACKEND = '${currentHttp}';`;

  return html`
    <div
      class="modal-backdrop active"
      style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;"
    >
      <article
        class="round border surface p-4"
        style="max-width: 580px; width: 100%; margin: 0 auto; background: #1e293b; color: #f8fafc; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6); max-height: 90vh; overflow-y: auto;"
      >
        <!-- Modal Header -->
        <div class="row items-center justify-between mb-3">
          <div class="row items-center gap-2">
            <div class="header-logo-icon" style="width: 32px; height: 32px; font-size: 16px;">
              <span>⚡</span>
            </div>
            <div>
              <h5 class="m-0 font-bold text-white text-base">WsRouter Server & Endpoint Hub</h5>
              <div class="text-xs text-slate-400">Connection status, heartbeats, and GitHub Pages export</div>
            </div>
          </div>
          <button class="button circle transparent small text-slate-400" onClick=${onClose}>
            <i class="material-symbols-outlined">close</i>
          </button>
        </div>

        <!-- Live Server Status Banner -->
        <div
          class="border round p-3 mb-3 row items-center justify-between"
          style="background: ${healthInfo.isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border-color: ${healthInfo.isOnline ? '#059669' : '#dc2626'};"
        >
          <div class="row items-center gap-2">
            <span
              class="live-dot-indicator ${healthInfo.isOnline ? 'live' : 'offline'}"
              style="background-color: ${healthInfo.isOnline ? '#10b981' : '#ef4444'}; box-shadow: 0 0 8px ${healthInfo.isOnline ? '#10b981' : '#ef4444'};"
            ></span>
            <div>
              <div class="bold text-sm text-white">
                ${healthInfo.isChecking
                  ? 'Checking Heartbeat...'
                  : healthInfo.isOnline
                  ? 'Backend Server Online'
                  : 'Backend Offline / Unreachable'}
              </div>
              <div class="text-xs text-slate-300">
                ${healthInfo.isOnline
                  ? `Response latency: ${healthInfo.latencyMs}ms • Server: ${healthInfo.serverInfo?.server || 'WsRouter'}`
                  : healthInfo.error || 'Check server connection or CORS settings'}
              </div>
            </div>
          </div>
          <button
            type="button"
            class="button border small round text-slate-200"
            onClick=${() => checkBackendHealth()}
            disabled=${healthInfo.isChecking}
            title="Probe backend heartbeat now"
          >
            <i class="material-symbols-outlined" style="font-size: 14px;">refresh</i>
            <span>${healthInfo.isChecking ? 'Probing...' : 'Recheck'}</span>
          </button>
        </div>

        ${copyFeedback && html`
          <div class="chip small border green text-white mb-3" style="width: 100%;">
            <i class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">check_circle</i>
            <span>${copyFeedback}</span>
          </div>
        `}

        <!-- Mode 1: Read-Only Info View (When hosted directly on Deno Server) -->
        ${isDenoHost && !showOverrideForm && html`
          <div>
            <div class="chip small border blue text-blue-200 mb-3" style="width: 100%; white-space: normal; height: auto; padding: 8px;">
              <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 6px;">info</i>
              <span>
                <strong>Running on Native Deno Server:</strong> This instance is hosting both the API and WebSocket server. You can copy the URLs below to configure your static GitHub Pages deployment.
              </span>
            </div>

            <!-- Read-only URL boxes with 1-click copy -->
            <div class="space-y-2 mb-3">
              <div>
                <label class="text-xs text-slate-400 block mb-1 bold">HTTP API Origin</label>
                <div class="row items-center gap-2">
                  <input
                    type="text"
                    readonly
                    class="border round p-2 flex-1 text-xs text-blue-300 bg-slate-900 font-mono"
                    value=${currentHttp}
                    style="border-color: #334155;"
                  />
                  <button
                    type="button"
                    class="button border small text-slate-200 round"
                    onClick=${() => handleCopy(currentHttp, 'HTTP URL')}
                    title="Copy HTTP URL"
                  >
                    <i class="material-symbols-outlined" style="font-size: 14px;">content_copy</i>
                    <span>Copy</span>
                  </button>
                </div>
              </div>

              <div>
                <label class="text-xs text-slate-400 block mb-1 bold">WebSocket (WSS) Origin</label>
                <div class="row items-center gap-2">
                  <input
                    type="text"
                    readonly
                    class="border round p-2 flex-1 text-xs text-emerald-300 bg-slate-900 font-mono"
                    value=${currentWs}
                    style="border-color: #334155;"
                  />
                  <button
                    type="button"
                    class="button border small text-slate-200 round"
                    onClick=${() => handleCopy(currentWs, 'WebSocket URL')}
                    title="Copy WebSocket URL"
                  >
                    <i class="material-symbols-outlined" style="font-size: 14px;">content_copy</i>
                    <span>Copy</span>
                  </button>
                </div>
              </div>

              <div>
                <label class="text-xs text-slate-400 block mb-1 bold">Config.js Hardcode Snippet (for GitHub Pages)</label>
                <div class="row items-center gap-2">
                  <input
                    type="text"
                    readonly
                    class="border round p-2 flex-1 text-xs text-amber-300 bg-slate-900 font-mono"
                    value=${configJsSnippet}
                    style="border-color: #334155;"
                  />
                  <button
                    type="button"
                    class="button border small text-slate-200 round"
                    onClick=${() => handleCopy(configJsSnippet, 'Config Snippet')}
                    title="Copy config.js snippet"
                  >
                    <i class="material-symbols-outlined" style="font-size: 14px;">content_copy</i>
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="row justify-between items-center mt-4 border-t border-slate-800 pt-3">
              <button
                type="button"
                class="button transparent small text-slate-400"
                onClick=${() => setShowOverrideForm(true)}
              >
                <i class="material-symbols-outlined" style="font-size: 14px;">edit</i>
                <span>Override with Custom Remote URL</span>
              </button>

              <button type="button" class="button fill primary small round" onClick=${onClose}>
                Close
              </button>
            </div>
          </div>
        `}

        <!-- Mode 2: Custom / Override Endpoint Config Form -->
        ${(!isDenoHost || showOverrideForm) && html`
          <div>
            ${isGitHubPages() && html`
              <div class="chip small border amber text-amber-200 mb-3" style="width: 100%; white-space: normal; height: auto; padding: 8px;">
                <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 6px;">info</i>
                <span>
                  <strong>GitHub Pages Static Deployment:</strong> Point this frontend to your deployed WsRouter Deno instance (e.g., Deno Deploy, Fly.io, Cloud Run, or localhost via tunnel).
                </span>
              </div>
            `}

            <form onSubmit=${handleSave}>
              <div class="field label border small mb-2">
                <input
                  type="text"
                  id="server-settings-backend-url-input"
                  value=${backendUrl}
                  onInput=${(e) => setBackendUrlState(e.target.value)}
                  placeholder="e.g. https://my-wsrouter.deno.dev or http://localhost:3000"
                />
                <label>Custom WsRouter Backend URL</label>
              </div>

              ${DEFAULT_REMOTE_BACKEND && html`
                <div class="text-xs text-slate-400 mb-2">
                  <span>Default in config.js: </span>
                  <code class="text-amber-300 font-mono">${DEFAULT_REMOTE_BACKEND}</code>
                </div>
              `}

              <div class="text-xs text-slate-400 mb-3 space-y-1 bg-slate-900 p-2 round border border-slate-800 font-mono">
                <div><strong>Resolved HTTP:</strong> <span class="text-blue-300">${currentHttp}</span></div>
                <div><strong>Resolved WS:</strong> <span class="text-emerald-300">${currentWs}</span></div>
              </div>

              ${saveStatus && html`
                <div class="chip small border green text-white mb-3" style="width: 100%;">
                  <i class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">check_circle</i>
                  <span>${saveStatus}</span>
                </div>
              `}

              <div class="row gap-2 justify-between items-center mt-4 border-t border-slate-800 pt-3">
                <div class="row gap-1">
                  <button type="button" class="button border small text-slate-300 round" onClick=${handleReset} title="Reset to default origin">
                    Reset
                  </button>
                  ${isHostedOnDenoServer() && html`
                    <button type="button" class="button transparent small text-slate-400" onClick=${() => setShowOverrideForm(false)}>
                      View Info
                    </button>
                  `}
                </div>

                <div class="row gap-2">
                  <button type="button" class="button border small text-slate-300 round" onClick=${onClose}>
                    Cancel
                  </button>
                  <button type="submit" class="button fill primary small round">
                    <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">save</i>
                    <span>Save & Reload</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        `}
      </article>
    </div>
  `;
}
