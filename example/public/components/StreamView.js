// example/public/components/StreamView.js
import { html } from 'https://esm.sh/htm/preact';
import { useRef, useEffect } from 'https://esm.sh/preact/hooks';
import { ReactionOverlay } from './ReactionOverlay.js';

export function StreamView({
  isBroadcasting,
  isLive,
  broadcasterName,
  broadcasterAvatar,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  isScreenSharing,
  onStartBroadcast,
  onStopBroadcast,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  floatingReactions,
  onSendReaction,
  user,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  // Bind local or remote media stream to video element
  useEffect(() => {
    if (!videoRef.current) return;
    const streamToAttach = isBroadcasting ? localStream : remoteStream;
    if (streamToAttach) {
      videoRef.current.srcObject = streamToAttach;
      videoRef.current.play().catch((err) => {
        console.warn('[StreamView] Autoplay prevented or interrupted:', err);
      });
    } else {
      videoRef.current.srcObject = null;
    }
  }, [localStream, remoteStream, isBroadcasting, isLive]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return html`
    <div class="stream-view-container">
      <!-- 16:9 Video Player Stage -->
      <div class="video-stage mb-3" ref=${containerRef}>
        <!-- Top Status Badge -->
        <div class="video-overlay-badge">
          <span class="live-dot-indicator ${isLive ? 'live' : 'offline'}"></span>
          <span class="bold text-xs uppercase">${isLive ? 'LIVE' : 'OFFLINE'}</span>
          ${isLive && broadcasterName && html`
            <span class="opacity-80 text-xs ml-1">• ${broadcasterAvatar || '👤'} ${broadcasterName}</span>
          `}
          ${isBroadcasting && html`
            <span class="chip small border bg-blue-900 text-blue-200 ml-2" style="font-size: 0.65rem; padding: 1px 6px;">
              YOU ARE BROADCASTING
            </span>
          `}
        </div>

        <!-- Floating Reactions Particles Layer (Active only when live stream or broadcasting) -->
        ${(isLive || isBroadcasting) && html`
          <${ReactionOverlay}
            floatingReactions=${floatingReactions}
            onSendReaction=${onSendReaction}
          />
        `}

        <!-- Active Video Element -->
        <video
          ref=${videoRef}
          autoplay
          playsinline
          muted=${isBroadcasting}
          class="stage-video-element ${isLive || isBroadcasting ? 'visible' : 'hidden'}"
        ></video>

        <!-- Offline / Waiting Placeholder State -->
        ${!isLive && !isBroadcasting && html`
          <div class="stage-placeholder text-center p-4">
            <div class="avatar-pulse mb-3">
              <i class="material-symbols-outlined text-slate-500" style="font-size: 56px;">videocam_off</i>
            </div>
            <h6 class="m-0 font-bold text-slate-200">No Live Stream Currently Active</h6>
            <p class="text-sm text-slate-400 mt-1 mb-3" style="max-width: 360px; margin-left:auto; margin-right:auto;">
              Click below to start broadcasting your webcam or screen share to everyone online in this room.
            </p>
            <button
              class="button fill primary round"
              onClick=${onStartBroadcast}
            >
              <i class="material-symbols-outlined" style="font-size: 20px; margin-right: 6px;">videocam</i>
              <span>Start Webcam Broadcast</span>
            </button>
          </div>
        `}

        <!-- Bottom Controls Bar inside Video Stage -->
        <div class="video-bottom-bar row items-center justify-between p-2">
          <div class="row items-center gap-2">
            ${isBroadcasting && html`
              <span class="chip small border bg-emerald-950 text-emerald-300">
                <i class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">sensors</i>
                Streaming to Peers
              </span>
            `}
            ${!isBroadcasting && isLive && html`
              <span class="chip small border bg-blue-950 text-blue-300">
                <i class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">visibility</i>
                Watching Live Stream
              </span>
            `}
          </div>

          <div class="row items-center gap-2">
            <button
              class="button circle small transparent text-white"
              onClick=${toggleFullscreen}
              title="Toggle Fullscreen"
            >
              <i class="material-symbols-outlined" style="font-size: 20px;">fullscreen</i>
            </button>
          </div>
        </div>
      </div>

      <!-- Action & Media Controls Deck -->
      <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
        <div class="row items-center justify-between wrap gap-3">
          <!-- Left: Broadcast Master Button -->
          <div>
            ${!isBroadcasting ? html`
              <button
                class="button fill primary round"
                onClick=${onStartBroadcast}
                title="Start broadcasting your webcam and microphone"
              >
                <i class="material-symbols-outlined" style="font-size: 20px; margin-right: 6px;">videocam</i>
                <span>Go Live (Webcam)</span>
              </button>
            ` : html`
              <button
                class="button fill red round"
                onClick=${onStopBroadcast}
                title="End webcam streaming session"
              >
                <i class="material-symbols-outlined" style="font-size: 20px; margin-right: 6px;">stop_circle</i>
                <span>End Broadcast</span>
              </button>
            `}
          </div>

          <!-- Middle: Broadcaster Media Controls -->
          ${isBroadcasting ? html`
            <div class="row items-center gap-2">
              <!-- Mute / Unmute Microphone -->
              <button
                class="button small round ${isMuted ? 'fill red' : 'border text-white'}"
                onClick=${onToggleMic}
                title=${isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                <i class="material-symbols-outlined" style="font-size: 18px; margin-right: 4px;">
                  ${isMuted ? 'mic_off' : 'mic'}
                </i>
                <span>${isMuted ? 'Muted' : 'Mic On'}</span>
              </button>

              <!-- Turn Video On / Off -->
              <button
                class="button small round ${isVideoOff ? 'fill red' : 'border text-white'}"
                onClick=${onToggleCamera}
                title=${isVideoOff ? 'Turn camera on' : 'Turn camera off'}
              >
                <i class="material-symbols-outlined" style="font-size: 18px; margin-right: 4px;">
                  ${isVideoOff ? 'videocam_off' : 'videocam'}
                </i>
                <span>${isVideoOff ? 'Camera Off' : 'Camera On'}</span>
              </button>

              <!-- Screen Share Toggle -->
              <button
                class="button small round ${isScreenSharing ? 'fill primary' : 'border text-white'}"
                onClick=${onToggleScreenShare}
                title=${isScreenSharing ? 'Switch back to webcam' : 'Share your screen'}
              >
                <i class="material-symbols-outlined" style="font-size: 18px; margin-right: 4px;">
                  ${isScreenSharing ? 'screen_share' : 'present_to_all'}
                </i>
                <span>${isScreenSharing ? 'Sharing Screen' : 'Share Screen'}</span>
              </button>
            </div>
          ` : html`
            <!-- Viewer Tip / Guidance -->
            <div class="text-xs text-slate-400 hide-on-mobile">
              ${isLive ? '💡 Watching live P2P stream via WebRTC mesh.' : '💡 Ready to broadcast? Click "Go Live" above.'}
            </div>
          `}

          <!-- Right: Peer & Room Summary -->
          <div class="row items-center gap-2">
            <span class="chip small border" style="font-size: 0.75rem;">
              Room: <strong class="ml-1 text-slate-200">#${user.room || 'main-stage'}</strong>
            </span>
          </div>
        </div>
      </article>
    </div>
  `;
}
