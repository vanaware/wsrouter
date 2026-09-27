// example/public/components/EntryGate.js
import { html } from 'https://esm.sh/htm/preact';
import { useState } from 'https://esm.sh/preact/hooks';

const AVATARS = ['👨‍💻', '👩‍💻', '🦊', '🚀', '🧙‍♂️', '🎨', '🐱', '🦁', '🤖', '👑', '⚡', '🎧'];

export function EntryGate({ initialName, initialAvatar, initialRoom, onSubmit, isModal = false, onClose }) {
  const [name, setName] = useState(initialName || '');
  const [avatar, setAvatar] = useState(initialAvatar || '👨‍💻');
  const [room, setRoom] = useState(initialRoom || 'main-stage');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e?.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter your name before joining.');
      return;
    }
    if (cleanName.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    setError('');
    onSubmit({ name: cleanName, avatar, room: room.trim() || 'main-stage' });
  };

  const content = html`
    <article class="round border surface p-4" style="max-width: 480px; margin: 0 auto; background: #1e293b; color: #f8fafc; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
      <div class="row items-center justify-between mb-3">
        <div class="row items-center gap-2">
          <span style="font-size: 32px;">🎥</span>
          <div>
            <h5 class="m-0 font-bold text-white">${isModal ? 'Edit Profile' : 'Join Live Stream Room'}</h5>
            <div class="text-xs text-slate-400">Choose your name and avatar to interact</div>
          </div>
        </div>
        ${isModal && html`
          <button class="button circle transparent small text-slate-400" onClick=${onClose}>
            <i class="material-symbols-outlined">close</i>
          </button>
        `}
      </div>

      <form onSubmit=${handleSubmit}>
        <!-- Name Input -->
        <div class="field label border small mb-3">
          <input
            type="text"
            id="entry-gate-name-input"
            value=${name}
            onInput=${(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            placeholder="e.g. Alex Dev, Sarah, John"
            required
            autoFocus
          />
          <label>Your Display Name</label>
        </div>

        <!-- Room Selector -->
        <div class="field label border small mb-3">
          <input
            type="text"
            id="entry-gate-room-input"
            value=${room}
            onInput=${(e) => setRoom(e.target.value)}
            placeholder="e.g. main-stage, gaming, tech-talk"
          />
          <label>Stream Room ID</label>
        </div>

        <!-- Avatar Selection Grid -->
        <div class="mb-3">
          <label class="text-xs text-slate-300 bold block mb-2">Pick an Avatar</label>
          <div class="row wrap gap-2">
            ${AVATARS.map(
              (av) => html`
                <button
                  type="button"
                  class="button square ${avatar === av ? 'fill primary' : 'border'}"
                  style="font-size: 20px; width: 44px; height: 44px;"
                  onClick=${() => setAvatar(av)}
                >
                  ${av}
                </button>
              `
            )}
          </div>
        </div>

        ${error && html`
          <div class="chip small border red text-white mb-3" style="width: 100%;">
            <i class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">error</i>
            <span>${error}</span>
          </div>
        `}

        <div class="row gap-2 justify-end mt-4">
          ${isModal && html`
            <button type="button" class="button border text-slate-300" onClick=${onClose}>
              Cancel
            </button>
          `}
          <button type="submit" class="button fill primary max">
            <i class="material-symbols-outlined" style="font-size: 18px; margin-right: 4px;">login</i>
            <span>${isModal ? 'Save Profile' : 'Enter Live Room'}</span>
          </button>
        </div>
      </form>
    </article>
  `;

  if (isModal) {
    return html`
      <div
        class="modal-backdrop active"
        style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;"
      >
        ${content}
      </div>
    `;
  }

  return html`
    <div class="flex items-center justify-center p-4" style="min-height: 70vh;">
      ${content}
    </div>
  `;
}
