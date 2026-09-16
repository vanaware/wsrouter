// example/public/components/ChatPanel.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useRef, useEffect } from 'https://esm.sh/preact/hooks';

export function ChatPanel({ messages, onSendMessage, user, isLive, broadcasterId }) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    onSendMessage(text);
    setInputText('');
  };

  const quickSendEmoji = (emoji) => {
    onSendMessage(emoji);
  };

  return html`
    <article class="round border surface p-3 chat-panel-article flex flex-col" style="background: #1e293b; color: #f8fafc; height: 100%;">
      <!-- Header -->
      <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
        <div class="row items-center gap-2">
          <i class="material-symbols-outlined text-blue-400" style="font-size: 20px;">forum</i>
          <h6 class="m-0 font-bold text-white text-sm">Live Room Chat</h6>
        </div>
        <span class="text-xs text-slate-400">${messages.length} messages</span>
      </div>

      <!-- Messages Scroll Area -->
      <div class="chat-messages-container max flex-1 overflow-y-auto mb-2 pr-1" ref=${scrollRef} style="min-height: 220px; max-height: 380px;">
        ${messages.length === 0 && html`
          <div class="text-center p-4 text-slate-500 text-xs">
            <i class="material-symbols-outlined mb-1" style="font-size: 28px;">chat_bubble_outline</i>
            <div>No messages yet in this room. Say hello! 👋</div>
          </div>
        `}

        ${messages.map((msg, index) => {
          const isMe = msg.userId === user.userId;
          const isBroadcaster = isLive && msg.userId === broadcasterId;
          const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return html`
            <div key=${msg.id || index} class="chat-message-row mb-2 ${isMe ? 'is-me' : ''}">
              <div class="row items-start gap-2">
                <span class="chat-avatar" style="font-size: 18px; line-height: 1;">${msg.avatar || '👤'}</span>
                <div class="chat-bubble flex-1" style="background: ${isMe ? 'rgba(37, 99, 235, 0.25)' : 'rgba(51, 65, 85, 0.4)'}; border: 1px solid ${isMe ? 'rgba(59, 130, 246, 0.4)' : 'rgba(71, 85, 105, 0.4)'}; border-radius: 8px; padding: 6px 10px;">
                  <div class="row items-center justify-between gap-1 mb-1">
                    <div class="row items-center gap-1">
                      <strong class="text-xs ${isMe ? 'text-blue-300' : 'text-slate-200'}">${msg.from || 'User'}</strong>
                      ${isBroadcaster && html`
                        <span class="chip small border bg-red-950 text-red-300" style="font-size: 0.6rem; padding: 0 4px;">
                          HOST
                        </span>
                      `}
                      ${isMe && html`
                        <span class="text-slate-400 text-xs" style="font-size: 0.65rem;">(you)</span>
                      `}
                    </div>
                    <span class="text-xs text-slate-500" style="font-size: 0.65rem;">${time}</span>
                  </div>
                  <div class="chat-text text-sm break-words text-slate-100">${msg.text}</div>
                </div>
              </div>
            </div>
          `;
        })}
      </div>

      <!-- Quick Emoji Bar -->
      <div class="row items-center gap-1 mb-2 pt-1 border-t border-slate-700">
        <span class="text-xs text-slate-400 mr-1">Quick:</span>
        ${['👍', '❤️', '🔥', '🚀', '👋', '🎉'].map(
          (emoji) => html`
            <button
              type="button"
              class="button circle small transparent"
              style="min-width: 28px; width: 28px; height: 28px; padding: 0; font-size: 14px;"
              onClick=${() => quickSendEmoji(emoji)}
            >
              ${emoji}
            </button>
          `
        )}
      </div>

      <!-- Input Form -->
      <form onSubmit=${handleSubmit} class="row items-center gap-2">
        <div class="field label border small m-0 flex-1" style="background: rgba(15, 23, 42, 0.6);">
          <input
            type="text"
            id="chat-message-input"
            value=${inputText}
            onInput=${(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            autoComplete="off"
          />
          <label>Chat message</label>
        </div>
        <button type="submit" class="button fill primary circle" style="width: 40px; height: 40px; padding: 0;" title="Send message">
          <i class="material-symbols-outlined" style="font-size: 18px;">send</i>
        </button>
      </form>
    </article>
  `;
}
