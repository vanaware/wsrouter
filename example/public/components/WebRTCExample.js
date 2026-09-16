// example/public/components/WebRTCExample.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef, useCallback } from 'https://esm.sh/preact/hooks';
import { StreamView } from './StreamView.js';
import { ChatPanel } from './ChatPanel.js';
import { OnlineUsers } from './OnlineUsers.js';
import { StreamStats } from './StreamStats.js';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function WebRTCExample({ user, activeMobileTab, showStats, setShowStats, onOpenViewerTab }) {
  // Connection & Presence State
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);

  // WebRTC & Stream State
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [broadcasterId, setBroadcasterId] = useState(null);
  const [broadcasterName, setBroadcasterName] = useState('');
  const [broadcasterAvatar, setBroadcasterAvatar] = useState('👤');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Diagnostic Stats
  const [stats, setStats] = useState({
    wsConnected: false,
    iceState: 'idle',
    peerCount: 0,
  });

  // Refs for persistent connection state
  const wsRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // Map<peerId, RTCPeerConnection>
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const broadcasterIdRef = useRef(null);
  const isBroadcastingRef = useRef(false);

  localStreamRef.current = localStream;
  remoteStreamRef.current = remoteStream;
  broadcasterIdRef.current = broadcasterId;
  isBroadcastingRef.current = isBroadcasting;

  const sendSignaling = useCallback((payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const spawnReaction = useCallback((emoji) => {
    const id = `${Date.now()}_${Math.random()}`;
    const left = Math.floor(Math.random() * 60) + 20; // 20% - 80%
    const duration = (Math.random() * 0.6 + 1.8).toFixed(2);
    setFloatingReactions((prev) => [...prev, { id, emoji, left, duration }]);

    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, parseFloat(duration) * 1000);
  }, []);

  // Broadcaster: connect to a new viewer
  const connectToViewer = useCallback(async (viewerId) => {
    if (!localStreamRef.current) return;
    try {
      console.log(`[WebRTC] Creating RTCPeerConnection to viewer: ${viewerId}`);
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(viewerId, pc);

      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignaling({
            type: 'webrtc_candidate',
            candidate: event.candidate,
            from: user.userId,
            target: viewerId,
            room: user.room,
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        setStats((prev) => ({
          ...prev,
          iceState: pc.iceConnectionState,
          peerCount: peerConnectionsRef.current.size,
        }));
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignaling({
        type: 'webrtc_offer',
        sdp: offer.sdp,
        from: user.userId,
        target: viewerId,
        room: user.room,
      });

      setStats((prev) => ({
        ...prev,
        peerCount: peerConnectionsRef.current.size,
      }));
    } catch (err) {
      console.error(`[WebRTC] Error connecting to viewer ${viewerId}:`, err);
    }
  }, [user.userId, user.room, sendSignaling]);

  // Viewer: handle incoming offer from broadcaster
  const handleReceiveOffer = useCallback(async (data) => {
    try {
      console.log(`[WebRTC] Received offer from broadcaster: ${data.from}`);
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(data.from, pc);

      pc.ontrack = (event) => {
        console.log('[WebRTC] Received remote stream track:', event.streams[0]);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          setIsLive(true);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignaling({
            type: 'webrtc_candidate',
            candidate: event.candidate,
            from: user.userId,
            target: data.from,
            room: user.room,
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        setStats((prev) => ({
          ...prev,
          iceState: pc.iceConnectionState,
          peerCount: peerConnectionsRef.current.size,
        }));
      };

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignaling({
        type: 'webrtc_answer',
        sdp: answer.sdp,
        from: user.userId,
        target: data.from,
        room: user.room,
      });

      setStats((prev) => ({
        ...prev,
        peerCount: peerConnectionsRef.current.size,
      }));
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err);
    }
  }, [user.userId, user.room, sendSignaling]);

  // Broadcaster: handle answer
  const handleReceiveAnswer = useCallback(async (data) => {
    const pc = peerConnectionsRef.current.get(data.from);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
      } catch (err) {
        console.error('[WebRTC] Error setting remote answer:', err);
      }
    }
  }, []);

  // Handle ICE candidate
  const handleReceiveCandidate = useCallback(async (data) => {
    const pc = peerConnectionsRef.current.get(data.from);
    if (pc && data.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
    }
  }, []);

  // Media Broadcast controls
  const handleStartBroadcast = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true,
      });

      setLocalStream(stream);
      setIsBroadcasting(true);
      setIsLive(true);
      setBroadcasterId(user.userId);
      setBroadcasterName(user.name);
      setBroadcasterAvatar(user.avatar);
      setIsMuted(false);
      setIsVideoOff(false);
      setIsScreenSharing(false);

      sendSignaling({
        type: 'broadcaster_started',
        broadcasterId: user.userId,
        broadcasterName: user.name,
        broadcasterAvatar: user.avatar,
        room: user.room,
      });

      users.forEach((u) => {
        if (u.userId !== user.userId) {
          connectToViewer(u.userId);
        }
      });
    } catch (err) {
      console.error('[WebRTC] Camera access denied or failed:', err);
      alert('Could not access camera or microphone: ' + err.message);
    }
  };

  const handleStopBroadcast = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    setLocalStream(null);
    setIsBroadcasting(false);
    setIsLive(false);
    setBroadcasterId(null);
    setBroadcasterName('');
    setIsScreenSharing(false);

    sendSignaling({
      type: 'broadcaster_stopped',
      broadcasterId: user.userId,
      room: user.room,
    });
  };

  const handleToggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const handleToggleCamera = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const handleToggleScreenShare = async () => {
    if (!isBroadcasting) return;

    if (isScreenSharing) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: !isMuted });
        const newVideoTrack = camStream.getVideoTracks()[0];

        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(newVideoTrack);
        });

        setLocalStream(camStream);
        setIsScreenSharing(false);
      } catch (err) {
        console.error('Error switching back to webcam:', err);
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        screenTrack.onended = () => {
          handleToggleScreenShare();
        };

        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        setLocalStream(screenStream);
        setIsScreenSharing(true);
      } catch (err) {
        console.error('Error starting screen share:', err);
      }
    }
  };

  const handleSendMessage = (text) => {
    if (!text) return;
    sendSignaling({
      type: 'chat',
      text,
      room: user.room,
    });
  };

  const handleSendReaction = (emoji) => {
    spawnReaction(emoji);
    sendSignaling({
      type: 'stream_reaction',
      emoji,
      from: user.name,
      room: user.room,
    });
  };

  // WebSocket lifecycle
  useEffect(() => {
    if (!user.isRegistered) return;

    let reconnectTimer = null;
    let isCancelled = false;

    const connectWebSocket = () => {
      if (isCancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/webrtc/${encodeURIComponent(user.room)}?userId=${encodeURIComponent(user.userId)}&name=${encodeURIComponent(user.name)}&avatar=${encodeURIComponent(user.avatar)}&role=${isBroadcastingRef.current ? 'broadcaster' : 'viewer'}`;

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setStats((prev) => ({ ...prev, wsConnected: true }));

        if (!isBroadcastingRef.current) {
          socket.send(JSON.stringify({
            type: 'request_stream',
            userId: user.userId,
            room: user.room,
          }));
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'presence_state') {
            setUsers(data.users || []);
            return;
          }
          if (data.type === 'presence_join') {
            setUsers((prev) => {
              const existing = prev.filter((u) => u.userId !== data.user.userId);
              return [...existing, data.user];
            });

            if (isBroadcastingRef.current && data.user.userId !== user.userId) {
              connectToViewer(data.user.userId);
            }
            return;
          }
          if (data.type === 'presence_leave') {
            setUsers((prev) => prev.filter((u) => u.userId !== data.userId));
            const pc = peerConnectionsRef.current.get(data.userId);
            if (pc) {
              pc.close();
              peerConnectionsRef.current.delete(data.userId);
            }
            return;
          }
          if (data.type === 'presence_update') {
            setUsers((prev) =>
              prev.map((u) => (u.userId === data.userId ? { ...u, data: { ...u.data, ...data.data } } : u))
            );
            return;
          }

          if (data.type === 'broadcaster_started') {
            setIsLive(true);
            setBroadcasterId(data.broadcasterId);
            setBroadcasterName(data.broadcasterName || 'Host');
            setBroadcasterAvatar(data.broadcasterAvatar || '👤');

            if (!isBroadcastingRef.current && data.broadcasterId !== user.userId) {
              socket.send(JSON.stringify({
                type: 'request_stream',
                userId: user.userId,
                room: user.room,
              }));
            }
            return;
          }

          if (data.type === 'broadcaster_stopped') {
            setIsLive(false);
            setBroadcasterId(null);
            setBroadcasterName('');
            setRemoteStream(null);
            peerConnectionsRef.current.forEach((pc) => pc.close());
            peerConnectionsRef.current.clear();
            return;
          }

          if (data.type === 'request_stream' && isBroadcastingRef.current) {
            connectToViewer(data.userId);
            return;
          }

          if (data.type === 'webrtc_offer' && data.target === user.userId) {
            handleReceiveOffer(data);
            return;
          }

          if (data.type === 'webrtc_answer' && data.target === user.userId) {
            handleReceiveAnswer(data);
            return;
          }

          if (data.type === 'webrtc_candidate' && data.target === user.userId) {
            handleReceiveCandidate(data);
            return;
          }

          if (data.type === 'chat') {
            setMessages((prev) => [...prev, data]);
            return;
          }

          if (data.type === 'stream_reaction') {
            spawnReaction(data.emoji);
            return;
          }
        } catch (err) {
          console.error('[WebRTC] Parse error:', err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        setStats((prev) => ({ ...prev, wsConnected: false }));
        if (!isCancelled) {
          reconnectTimer = setTimeout(connectWebSocket, 2000);
        }
      };
    };

    connectWebSocket();

    return () => {
      isCancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user.isRegistered, user.room, user.userId, user.name, user.avatar, connectToViewer, handleReceiveOffer, handleReceiveAnswer, handleReceiveCandidate, spawnReaction]);

  return html`
    <div>
      <!-- Optional Diagnostic Stats Drawer -->
      ${showStats && html`
        <${StreamStats}
          stats=${stats}
          room=${user.room}
          user=${user}
          isBroadcasting=${isBroadcasting}
          isLive=${isLive}
          onClose=${() => setShowStats(false)}
        />
      `}

      <!-- Main Responsive Grid -->
      <div class="grid">
        <!-- Main Column: Stream Player & Broadcaster Deck -->
        <div class="s12 m7 l8 ${activeMobileTab !== 'stream' ? 'hide-on-mobile' : ''}">
          <${StreamView}
            isBroadcasting=${isBroadcasting}
            isLive=${isLive}
            broadcasterName=${broadcasterName}
            broadcasterAvatar=${broadcasterAvatar}
            localStream=${localStream}
            remoteStream=${remoteStream}
            isMuted=${isMuted}
            isVideoOff=${isVideoOff}
            isScreenSharing=${isScreenSharing}
            onStartBroadcast=${handleStartBroadcast}
            onStopBroadcast=${handleStopBroadcast}
            onToggleMic=${handleToggleMic}
            onToggleCamera=${handleToggleCamera}
            onToggleScreenShare=${handleToggleScreenShare}
            floatingReactions=${floatingReactions}
            onSendReaction=${handleSendReaction}
            streamStats=${stats}
            user=${user}
          />
        </div>

        <!-- Sidebar Column: Chat Panel & Who is Online -->
        <div class="s12 m5 l4">
          <!-- Chat Panel -->
          <div class="mb-3 ${activeMobileTab === 'users' ? 'hide-on-mobile' : ''}">
            <${ChatPanel}
              messages=${messages}
              onSendMessage=${handleSendMessage}
              user=${user}
              isLive=${isLive}
              broadcasterId=${broadcasterId}
            />
          </div>

          <!-- Who is Online Panel -->
          <div class="${activeMobileTab === 'chat' ? 'hide-on-mobile' : ''}">
            <${OnlineUsers}
              users=${users}
              currentUserId=${user.userId}
              isLive=${isLive}
              broadcasterId=${broadcasterId}
            />
          </div>
        </div>
      </div>
    </div>
  `;
}
