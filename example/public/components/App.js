// example/public/components/App.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { Header } from './Header.js';
import { EntryGate } from './EntryGate.js';
import { WebRTCExample } from './WebRTCExample.js';
import { PresenceExample } from './PresenceExample.js';
import { JwtExample } from './JwtExample.js';
import { ApiInspectorExample } from './ApiInspectorExample.js';
import { ServerSettingsModal } from './ServerSettingsModal.js';
import { getCustomBackend } from './config.js';

export function App() {
  // User Identity State
  const [user, setUser] = useState(() => {
    const savedName = localStorage.getItem('wsrouter_user_name');
    const savedAvatar = localStorage.getItem('wsrouter_user_avatar') || '👨‍💻';
    const savedRoom = localStorage.getItem('wsrouter_user_room') || 'main-stage';
    let savedId = localStorage.getItem('wsrouter_user_id');

    if (!savedId) {
      savedId = `usr_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('wsrouter_user_id', savedId);
    }

    return {
      userId: savedId,
      name: savedName || '',
      avatar: savedAvatar,
      room: savedRoom,
      isRegistered: Boolean(savedName),
    };
  });

  // UI Navigation State
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') || 'webrtc';
  });

  const [activeMobileSubTab, setActiveMobileSubTab] = useState('stream');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Sync tab with URL query parameter
  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    const url = new URL(window.location);
    url.searchParams.set('tab', tabId);
    window.history.replaceState({}, '', url);
  };

  const handleRegisterProfile = ({ name, avatar, room }) => {
    localStorage.setItem('wsrouter_user_name', name);
    localStorage.setItem('wsrouter_user_avatar', avatar);
    localStorage.setItem('wsrouter_user_room', room);

    setUser((prev) => ({
      ...prev,
      name,
      avatar,
      room,
      isRegistered: true,
    }));
    setIsEditingProfile(false);
  };

  const handleOpenViewerTab = () => {
    const randomGuestNum = Math.floor(Math.random() * 900 + 100);
    const viewerId = `usr_guest_${randomGuestNum}`;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'webrtc');
    url.searchParams.set('autojoin', '1');
    url.searchParams.set('name', `Viewer_${randomGuestNum}`);
    url.searchParams.set('avatar', '👀');
    url.searchParams.set('userId', viewerId);
    window.open(url.toString(), '_blank');
  };

  // Support autojoin via URL query params (e.g. for viewer tabs)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autojoin') === '1') {
      const qName = urlParams.get('name') || `Guest ${Math.floor(Math.random() * 1000)}`;
      const qAvatar = urlParams.get('avatar') || '👀';
      const qId = urlParams.get('userId') || `usr_${Math.random().toString(36).substring(2, 8)}`;
      const qRoom = urlParams.get('room') || 'main-stage';

      setUser({
        userId: qId,
        name: qName,
        avatar: qAvatar,
        room: qRoom,
        isRegistered: true,
      });
    }
  }, []);

  // If user hasn't registered a name, display initial gate
  if (!user.isRegistered) {
    return html`
      <div class="app-root-container p-4">
        <${EntryGate}
          initialName=${user.name}
          initialAvatar=${user.avatar}
          initialRoom=${user.room}
          onSubmit=${handleRegisterProfile}
        />
      </div>
    `;
  }

  return html`
    <div class="app-root-container p-3 sm:p-4 max">
      <!-- Top Navigation & Header -->
      <${Header}
        activeTab=${activeTab}
        onSelectTab=${handleSelectTab}
        user=${user}
        onEditProfile=${() => setIsEditingProfile(true)}
        showStats=${showStats}
        onToggleStats=${() => setShowStats(!showStats)}
        onOpenViewerTab=${handleOpenViewerTab}
        activeMobileSubTab=${activeMobileSubTab}
        onSelectMobileSubTab=${setActiveMobileSubTab}
        onOpenSettings=${() => setIsSettingsOpen(true)}
        isCustomBackend=${Boolean(getCustomBackend())}
      />

      <!-- Pages View Area -->
      <main class="pages-wrapper">
        <!-- 🎥 WebRTC Live Streaming Page -->
        <div class="page ${activeTab === 'webrtc' ? 'active' : 'hidden'}" id="page-webrtc">
          ${activeTab === 'webrtc' && html`
            <${WebRTCExample}
              user=${user}
              activeMobileTab=${activeMobileSubTab}
              showStats=${showStats}
              setShowStats=${setShowStats}
              onOpenViewerTab=${handleOpenViewerTab}
            />
          `}
        </div>

        <!-- 👥 Presence Tracker Page -->
        <div class="page ${activeTab === 'presence' ? 'active' : 'hidden'}" id="page-presence">
          ${activeTab === 'presence' && html`
            <${PresenceExample}
              user=${user}
            />
          `}
        </div>

        <!-- 🔐 JWT Auth & WebSocket Page -->
        <div class="page ${activeTab === 'jwt' ? 'active' : 'hidden'}" id="page-jwt">
          ${activeTab === 'jwt' && html`
            <${JwtExample} />
          `}
        </div>

        <!-- ⚡ REST Route & Parameter Inspector Page -->
        <div class="page ${activeTab === 'rest' ? 'active' : 'hidden'}" id="page-rest">
          ${activeTab === 'rest' && html`
            <${ApiInspectorExample} />
          `}
        </div>
      </main>

      <!-- Profile Edit Modal -->
      ${isEditingProfile && html`
        <${EntryGate}
          initialName=${user.name}
          initialAvatar=${user.avatar}
          initialRoom=${user.room}
          onSubmit=${handleRegisterProfile}
          isModal=${true}
          onClose=${() => setIsEditingProfile(false)}
        />
      `}

      <!-- Backend Server Settings Modal -->
      <${ServerSettingsModal}
        isOpen=${isSettingsOpen}
        onClose=${() => setIsSettingsOpen(false)}
      />
    </div>
  `;
}
