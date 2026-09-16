// example/public/components/ApiInspectorExample.js
import { html } from 'https://esm.sh/htm/preact';
import { useState } from 'https://esm.sh/preact/hooks';

const ENDPOINTS = [
  { method: 'GET', url: '/api/stream/main-stage', desc: 'Inspect active WebRTC stream and live viewers' },
  { method: 'GET', url: '/api/presence/general', desc: 'Inspect online presence list in #general' },
  { method: 'GET', url: '/api/presence', desc: 'Inspect all online presence groups and socket count' },
  { method: 'GET', url: '/api/echo/hello-wsrouter', desc: 'Test URL path parameter extraction' },
  { method: 'POST', url: '/api/echo', body: JSON.stringify({ message: 'Testing WsRouter body parsing', timestamp: Date.now() }, null, 2), desc: 'Test POST request body parsing & echo' },
  { method: 'POST', url: '/api/login', body: JSON.stringify({ username: 'admin', password: '123' }, null, 2), desc: 'Authenticate and receive signed HS256 JWT' },
];

export function ApiInspectorExample() {
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);
  const [customMethod, setCustomMethod] = useState(ENDPOINTS[0].method);
  const [customUrl, setCustomUrl] = useState(ENDPOINTS[0].url);
  const [customBody, setCustomBody] = useState(ENDPOINTS[0].body || '');
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = (ep) => {
    setSelectedEndpoint(ep);
    setCustomMethod(ep.method);
    setCustomUrl(ep.url);
    setCustomBody(ep.body || '');
  };

  const executeRequest = async () => {
    setIsLoading(true);
    const startTime = performance.now();
    try {
      const options = {
        method: customMethod,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (customMethod === 'POST' && customBody.trim()) {
        options.body = customBody;
      }

      const res = await fetch(customUrl, options);
      const elapsed = Math.round(performance.now() - startTime);

      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      setResponse({
        status: res.status,
        statusText: res.statusText || (res.status === 200 ? 'OK' : res.status === 201 ? 'Created' : ''),
        time: elapsed,
        data,
      });
    } catch (err) {
      setResponse({
        status: 0,
        statusText: 'Network Error',
        time: Math.round(performance.now() - startTime),
        data: { error: err.message },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return html`
    <div>
      <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
        <div class="row items-center gap-2">
          <i class="material-symbols-outlined text-blue-400" style="font-size: 24px;">bolt</i>
          <div>
            <h5 class="m-0 font-bold text-white text-base">REST API & Route Inspector</h5>
            <p class="text-xs text-slate-400 m-0">
              Directly interact with WsRouter HTTP route handlers, path parameter extractors, and JSON response endpoints.
            </p>
          </div>
        </div>
      </article>

      <div class="grid">
        <!-- Preset Endpoints List -->
        <div class="s12 m5 l4">
          <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
            <strong class="text-xs uppercase text-slate-400 font-bold block mb-2">Available Endpoints</strong>
            <div class="flex flex-col gap-2">
              ${ENDPOINTS.map((ep, idx) => {
                const isSelected = selectedEndpoint.url === ep.url && selectedEndpoint.method === ep.method;
                return html`
                  <button
                    key=${idx}
                    type="button"
                    class="button border small text-left p-2 rounded justify-start"
                    style="background: ${isSelected ? 'rgba(37, 99, 235, 0.2)' : 'rgba(15, 23, 42, 0.4)'}; border-color: ${isSelected ? '#3b82f6' : '#334155'}; height: auto;"
                    onClick=${() => handleSelect(ep)}
                  >
                    <div class="w-full">
                      <div class="row items-center gap-2 mb-1">
                        <span class="chip small ${ep.method === 'GET' ? 'bg-blue-950 text-blue-300' : 'bg-emerald-950 text-emerald-300'}" style="font-size: 0.65rem; padding: 1px 6px;">
                          ${ep.method}
                        </span>
                        <code class="text-xs text-slate-200 font-bold">${ep.url}</code>
                      </div>
                      <div class="text-xs text-slate-400">${ep.desc}</div>
                    </div>
                  </button>
                `;
              })}
            </div>
          </article>
        </div>

        <!-- Request Builder & Response Viewer -->
        <div class="s12 m7 l8">
          <!-- Request Builder -->
          <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
            <div class="row items-center gap-2 mb-2">
              <!-- Method -->
              <select
                class="button border small round bg-slate-900 text-white"
                value=${customMethod}
                onChange=${(e) => setCustomMethod(e.target.value)}
                style="width: 100px;"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>

              <!-- URL Input -->
              <div class="field label border small m-0 flex-1" style="background: rgba(15, 23, 42, 0.6);">
                <input
                  type="text"
                  value=${customUrl}
                  onInput=${(e) => setCustomUrl(e.target.value)}
                  placeholder="/api/..."
                />
                <label>Target URL Path</label>
              </div>

              <!-- Send Button -->
              <button
                type="button"
                class="button fill primary small round"
                onClick=${executeRequest}
                disabled=${isLoading}
              >
                <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">send</i>
                <span>${isLoading ? 'Sending...' : 'Execute'}</span>
              </button>
            </div>

            <!-- Body editor for POST -->
            ${customMethod === 'POST' && html`
              <div class="mt-2">
                <label class="text-xs text-slate-400 bold block mb-1">JSON Request Body:</label>
                <textarea
                  class="font-mono text-xs p-2 rounded bg-slate-900 border border-slate-700 text-slate-200 w-full"
                  rows="4"
                  value=${customBody}
                  onInput=${(e) => setCustomBody(e.target.value)}
                  style="width: 100%; box-sizing: border-box;"
                ></textarea>
              </div>
            `}
          </article>

          <!-- Response Viewer -->
          <article class="round border surface p-3" style="background: #0f172a; color: #f8fafc; border-color: #334155;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <strong class="text-xs text-slate-400 font-mono">RESPONSE INSPECTOR</strong>
              ${response && html`
                <div class="row items-center gap-2">
                  <span class="chip small ${response.status >= 200 && response.status < 300 ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}">
                    Status: ${response.status} ${response.statusText}
                  </span>
                  <span class="text-xs text-slate-400">${response.time} ms</span>
                </div>
              `}
            </div>

            <pre class="font-mono text-xs p-3 rounded bg-slate-950 text-emerald-400 overflow-x-auto m-0" style="min-height: 180px; max-height: 380px;">
              ${response ? JSON.stringify(response.data, null, 2) : '// Click "Execute" or select an endpoint on the left to see live response.'}
            </pre>
          </article>
        </div>
      </div>
    </div>
  `;
}
