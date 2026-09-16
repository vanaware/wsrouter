// example/public/components/config.js
/**
 * @file config.js
 * @description Centralized configuration, URL builder, heartbeat health-checker,
 * and graceful fallback engine for WsRouter.
 * 
 * Supports both Deno-hosted runtime servers and static GitHub Pages deployments.
 */

/**
 * OPTIONAL: You can hardcode a default remote Deno WsRouter backend instance here.
 * If empty (""), the app will default to current window.location on Deno server,
 * or prompt to configure a backend when hosted statically on GitHub Pages.
 * 
 * Example: export const DEFAULT_REMOTE_BACKEND = 'https://my-wsrouter.deno.dev';
 */
export const DEFAULT_REMOTE_BACKEND = '';

/**
 * Detects if the current client is hosted on GitHub Pages static hosting
 */
export function isGitHubPages() {
  return window.location.hostname.endsWith('github.io');
}

/**
 * Detects if the client is running directly from the Deno server
 */
export function isHostedOnDenoServer() {
  return !isGitHubPages();
}

/**
 * Retrieves the currently active custom backend URL (localStorage takes precedence over hardcoded default)
 */
export function getCustomBackend() {
  const stored = localStorage.getItem('wsrouter_custom_backend');
  if (stored !== null && stored !== undefined) {
    return stored.trim();
  }
  return DEFAULT_REMOTE_BACKEND ? DEFAULT_REMOTE_BACKEND.trim() : '';
}

/**
 * Sets or clears the custom backend URL in localStorage
 */
export function setCustomBackend(url) {
  if (!url || !url.trim()) {
    localStorage.removeItem('wsrouter_custom_backend');
  } else {
    localStorage.setItem('wsrouter_custom_backend', url.trim().replace(/\/+$/, ''));
  }
}

/**
 * Resolves the absolute HTTP origin for API requests
 */
export function getBackendHttpOrigin() {
  const custom = getCustomBackend();
  if (custom) {
    if (custom.startsWith('http://') || custom.startsWith('https://')) {
      return custom.replace(/\/+$/, '');
    }
    if (custom.startsWith('wss://')) return custom.replace('wss://', 'https://').replace(/\/+$/, '');
    if (custom.startsWith('ws://')) return custom.replace('ws://', 'http://').replace(/\/+$/, '');
    return `https://${custom.replace(/\/+$/, '')}`;
  }
  return window.location.origin;
}

/**
 * Resolves the absolute WebSocket origin (ws:// or wss://)
 */
export function getBackendWsOrigin() {
  const custom = getCustomBackend();
  if (custom) {
    if (custom.startsWith('wss://') || custom.startsWith('ws://')) {
      return custom.replace(/\/+$/, '');
    }
    if (custom.startsWith('https://')) return custom.replace('https://', 'wss://').replace(/\/+$/, '');
    if (custom.startsWith('http://')) return custom.replace('http://', 'ws://').replace(/\/+$/, '');
    return `wss://${custom.replace(/\/+$/, '')}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

/**
 * Builds a full WebSocket URL for a given path and query
 */
export function buildWsUrl(pathAndQuery) {
  const wsOrigin = getBackendWsOrigin();
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  return `${wsOrigin}${path}`;
}

/**
 * Builds a full HTTP API URL for a given endpoint path
 */
export function buildApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const custom = getCustomBackend();
  if (!custom && isHostedOnDenoServer()) {
    return cleanPath;
  }
  return `${getBackendHttpOrigin()}${cleanPath}`;
}

// ==========================================
// 💓 Heartbeat & Backend Health Diagnostics
// ==========================================

let lastHealthStatus = {
  isChecking: false,
  isOnline: false,
  latencyMs: null,
  timestamp: Date.now(),
  serverInfo: null,
  error: null,
};

const healthListeners = new Set();

function notifyHealthListeners() {
  for (const listener of healthListeners) {
    try {
      listener({ ...lastHealthStatus });
    } catch {
      // Ignore listener errors
    }
  }
}

export function subscribeBackendHealth(callback) {
  healthListeners.add(callback);
  callback({ ...lastHealthStatus });
  return () => healthListeners.delete(callback);
}

export function getLastBackendHealth() {
  return { ...lastHealthStatus };
}

/**
 * Gracefully checks backend heartbeat without throwing unhandled exceptions.
 */
export async function checkBackendHealth(timeoutMs = 3500) {
  lastHealthStatus.isChecking = true;
  notifyHealthListeners();

  const startTime = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const healthUrl = buildApiUrl('/api/health');

  try {
    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const elapsed = Math.round(performance.now() - startTime);

    if (res.ok) {
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = { status: 'ok' };
      }

      lastHealthStatus = {
        isChecking: false,
        isOnline: true,
        latencyMs: elapsed,
        timestamp: Date.now(),
        serverInfo: data,
        error: null,
      };
    } else {
      lastHealthStatus = {
        isChecking: false,
        isOnline: false,
        latencyMs: elapsed,
        timestamp: Date.now(),
        serverInfo: null,
        error: `Server responded with HTTP ${res.status}`,
      };
    }
  } catch (err) {
    clearTimeout(timer);
    const elapsed = Math.round(performance.now() - startTime);
    const isTimeout = err.name === 'AbortError';

    lastHealthStatus = {
      isChecking: false,
      isOnline: false,
      latencyMs: elapsed,
      timestamp: Date.now(),
      serverInfo: null,
      error: isTimeout ? `Request timed out after ${timeoutMs}ms` : (err.message || 'Connection unreachable / offline'),
    };
  }

  notifyHealthListeners();
  return { ...lastHealthStatus };
}

// Initial background probe on load
setTimeout(() => {
  checkBackendHealth().catch(() => {});
}, 300);

// Recurring heartbeat probe every 30 seconds
setInterval(() => {
  checkBackendHealth().catch(() => {});
}, 30000);
