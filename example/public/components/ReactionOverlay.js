// example/public/components/ReactionOverlay.js
import { html } from 'https://esm.sh/htm/preact';

export const EMOJIS = ['👏', '❤️', '🔥', '🚀', '👍', '🎉'];

export function ReactionOverlay({ floatingReactions, onSendReaction }) {
  return html`
    <div>
      <!-- Floating Particles Area -->
      <div class="floating-reactions-layer">
        ${floatingReactions.map(
          (reaction) => html`
            <span
              key=${reaction.id}
              class="floating-emoji-item"
              style="left: ${reaction.left}%; animation-duration: ${reaction.duration}s;"
            >
              ${reaction.emoji}
            </span>
          `
        )}
      </div>

      <!-- Instant Reaction Bar -->
      <div class="reaction-bar row items-center gap-1">
        ${EMOJIS.map(
          (emoji) => html`
            <button
              type="button"
              class="button circle small transparent reaction-btn"
              onClick=${() => onSendReaction(emoji)}
              title="Send ${emoji} reaction"
            >
              <span>${emoji}</span>
            </button>
          `
        )}
      </div>
    </div>
  `;
}
