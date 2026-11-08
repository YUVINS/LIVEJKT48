/**
 * JKT48 Multi-View Live Streaming Application
 * Supports IDN Live & SHOWROOM
 */

const State = {
  activeStreams: [],     // Active streams currently in grid
  availableLives: [],    // Live streams detected from /api/lives
  allMembers: [],        // All JKT48 members
  currentLayout: 'auto', // 'auto', '1x1', '1x2', '3-focus', '2x2', '3x2'
  soloStreamId: null,    // ID of stream currently playing audio
  masterMuted: false,    // Global mute flag
  isPolling: true,
  chatRoomId: null,
  chatInterval: null,
  companionCollapsed: false,
  companionInterval: null
};

// DOM References
const grid = document.getElementById('stream-grid');
const emptyState = document.getElementById('empty-state');
const countIdn = document.getElementById('count-idn');
const countSr = document.getElementById('count-sr');
const alertText = document.getElementById('live-alert-text');
const liveAvatarsContainer = document.getElementById('live-members-avatars');
const emptyStateLives = document.getElementById('empty-state-lives');

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  setupEventListeners();
  fetchMembers();
  fetchLives();

  // Restore saved streams from localStorage if available
  restoreSavedSession();

  // Poll live status every 25 seconds
  setInterval(() => {
    if (State.isPolling) fetchLives(true);
  }, 25000);
});

/**
 * Setup All Event Listeners
 */
function setupEventListeners() {
  // Layout dropdown
  const btnLayout = document.getElementById('btn-layout-dropdown');
  const menuLayout = document.getElementById('menu-layout');
  btnLayout?.addEventListener('click', (e) => {
    e.stopPropagation();
    menuLayout.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    menuLayout?.classList.add('hidden');
  });

  document.querySelectorAll('.layout-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const layout = btn.getAttribute('data-layout');
      setLayout(layout);
      menuLayout.classList.add('hidden');
    });
  });

  // Watch All button
  document.getElementById('btn-watch-all')?.addEventListener('click', () => {
    watchAllLives();
  });
  document.getElementById('btn-empty-add-all')?.addEventListener('click', () => {
    watchAllLives();
  });

  // Master Mute
  document.getElementById('btn-master-mute')?.addEventListener('click', toggleMasterMute);

  // Refresh
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    const icon = document.getElementById('icon-refresh');
    icon?.classList.add('animate-spin');
    fetchLives().finally(() => {
      setTimeout(() => icon?.classList.remove('animate-spin'), 600);
    });
  });

  // Fullscreen
  document.getElementById('btn-fullscreen')?.addEventListener('click', toggleFullscreen);

  // Clear all
  document.getElementById('btn-clear-all')?.addEventListener('click', clearAllStreams);

  // Modal Open/Close
  const modal = document.getElementById('modal-add');
  document.getElementById('btn-open-add')?.addEventListener('click', () => openModal());
  document.getElementById('btn-empty-open-modal')?.addEventListener('click', () => openModal());
  document.getElementById('btn-close-modal')?.addEventListener('click', () => closeModal());
  document.getElementById('btn-close-modal-footer')?.addEventListener('click', () => closeModal());
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Modal Tabs
  setupModalTabs();

  // Custom Stream Submit
  document.getElementById('btn-submit-custom')?.addEventListener('click', handleCustomStreamSubmit);

  // Search Members in Modal
  document.getElementById('input-search-member')?.addEventListener('input', (e) => {
    filterMembersRoster(e.target.value);
  });

  // Chat Drawer Close
  document.getElementById('btn-close-chat')?.addEventListener('click', closeChatDrawer);

  // Mobile Controls & Menu Drawer
  document.getElementById('btn-mobile-open-add')?.addEventListener('click', () => openModal());
  document.getElementById('btn-mobile-master-mute')?.addEventListener('click', toggleMasterMute);

  const mobileDrawer = document.getElementById('mobile-menu-drawer');
  const openMobileMenu = () => {
    mobileDrawer?.classList.remove('hidden');
    if (window.lucide) lucide.createIcons({ root: mobileDrawer });
  };
  const closeMobileMenu = () => {
    mobileDrawer?.classList.add('hidden');
  };

  document.getElementById('btn-mobile-menu')?.addEventListener('click', openMobileMenu);
  document.getElementById('btn-close-mobile-menu')?.addEventListener('click', closeMobileMenu);
  mobileDrawer?.addEventListener('click', (e) => {
    if (e.target === mobileDrawer) closeMobileMenu();
  });

  document.getElementById('mobile-btn-watch-all')?.addEventListener('click', () => {
    watchAllLives();
    closeMobileMenu();
  });
  document.getElementById('mobile-btn-refresh')?.addEventListener('click', () => {
    fetchLives();
    closeMobileMenu();
  });
  document.getElementById('mobile-btn-clear-all')?.addEventListener('click', () => {
    clearAllStreams();
    closeMobileMenu();
  });

  document.querySelectorAll('.mobile-layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layout = btn.getAttribute('data-layout');
      setLayout(layout);
      closeMobileMenu();
    });
  });

  // Companion Sidebar Events
  document.getElementById('btn-toggle-companion')?.addEventListener('click', () => {
    State.companionCollapsed = !State.companionCollapsed;
    updateCompanionPanel();
  });

  const tabChatBtn = document.getElementById('companion-tab-chat-btn');
  const tabOtherBtn = document.getElementById('companion-tab-other-btn');
  const chatContent = document.getElementById('companion-chat-content');
  const otherContent = document.getElementById('companion-other-content');

  tabChatBtn?.addEventListener('click', () => {
    tabChatBtn.className = 'px-3 py-1.5 border-b-2 border-rose-500 text-rose-400 flex items-center gap-1.5';
    tabOtherBtn.className = 'px-3 py-1.5 border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-1.5';
    chatContent?.classList.remove('hidden');
    otherContent?.classList.add('hidden');
  });

  tabOtherBtn?.addEventListener('click', () => {
    tabOtherBtn.className = 'px-3 py-1.5 border-b-2 border-rose-500 text-rose-400 flex items-center gap-1.5';
    tabChatBtn.className = 'px-3 py-1.5 border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-1.5';
    otherContent?.classList.remove('hidden');
    chatContent?.classList.add('hidden');
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'm' || e.key === 'M') toggleMasterMute();
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    if (e.key === 'r' || e.key === 'R') fetchLives();
    if (e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key) - 1;
      if (State.activeStreams[idx]) {
        toggleSoloAudio(State.activeStreams[idx].id);
      }
    }
  });
}

/**
 * Fetch All JKT48 Members Roster
 */
async function fetchMembers() {
  try {
    const res = await fetch('/api/members');
    const data = await res.json();
    State.allMembers = data.members || [];
    renderMembersRoster(State.allMembers);
  } catch (err) {
    console.error('Failed to load members:', err);
  }
}

/**
 * Fetch Current Live Streams
 */
async function fetchLives(isBackground = false) {
  try {
    const res = await fetch('/api/lives');
    const data = await res.json();
    if (!data.success) return;

    State.availableLives = data.lives || [];
    const countIdnVal = data.counts?.idn || 0;
    const countSrVal = data.counts?.showroom || 0;
    const totalCount = data.counts?.total || 0;

    // Update Counts
    if (countIdn) countIdn.textContent = countIdnVal;
    if (countSr) countSr.textContent = countSrVal;

    const mobileCount = document.getElementById('mobile-live-count');
    if (mobileCount) mobileCount.textContent = `${totalCount} Live`;
    const mobileMenuCount = document.getElementById('mobile-menu-live-count');
    if (mobileMenuCount) mobileMenuCount.textContent = `${totalCount} Live`;

    // Update Live Banner
    if (totalCount > 0) {
      const names = State.availableLives.map(l => l.member_nick || l.name).join(', ');
      if (alertText) {
        alertText.innerHTML = `🔴 <strong>${totalCount} Member Sedang Live:</strong> ${names}`;
      }
    } else {
      if (alertText) {
        alertText.innerHTML = `Belum ada member JKT48 yang sedang live saat ini.`;
      }
    }

    // Update Carousel & Lists
    renderLiveAvatarsCarousel(State.availableLives);
    renderModalLiveList(State.availableLives);
    renderEmptyStateLives(State.availableLives);

    const tabLiveCount = document.getElementById('tab-live-count');
    if (tabLiveCount) tabLiveCount.textContent = totalCount;

  } catch (err) {
    console.error('Error fetching lives:', err);
  }
}

/**
 * Render Live Avatars Carousel on Header
 */
function renderLiveAvatarsCarousel(lives) {
  if (!liveAvatarsContainer) return;
  liveAvatarsContainer.innerHTML = '';

  if (lives.length === 0) {
    liveAvatarsContainer.innerHTML = '<span class="text-xs text-slate-500 italic pr-2">Tidak ada live</span>';
    return;
  }

  lives.forEach(live => {
    const isAdded = State.activeStreams.some(s => s.id === live.id);
    const btn = document.createElement('button');
    btn.className = `relative group flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition ${
      isAdded ? 'bg-rose-950/80 border border-rose-600/50 text-white' : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800'
    }`;
    btn.title = `Klik untuk tonton ${live.name} (${live.platform_name})`;

    const platformBadgeColor = live.platform === 'idn' ? 'bg-rose-500' : 'bg-sky-500';

    btn.innerHTML = `
      <div class="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-slate-800 border border-slate-700">
        <img src="${live.avatar || 'https://via.placeholder.com/60'}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/60'">
        <span class="absolute bottom-0 right-0 w-2 h-2 rounded-full ${platformBadgeColor} border border-slate-950"></span>
      </div>
      <span class="font-medium truncate max-w-[80px]">${live.member_nick || live.name}</span>
      ${isAdded ? '<span class="text-[10px] text-rose-400 font-bold">✓</span>' : '+'}
    `;

    btn.addEventListener('click', () => {
      if (isAdded) {
        toggleSoloAudio(live.id);
      } else {
        addStream(live);
      }
    });

    liveAvatarsContainer.appendChild(btn);
  });
}

/**
 * Render Empty State Live Cards
 */
function renderEmptyStateLives(lives) {
  if (!emptyStateLives) return;
  emptyStateLives.innerHTML = '';

  if (lives.length === 0) {
    emptyStateLives.innerHTML = `
      <div class="col-span-full p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
        Sedang tidak ada siaran langsung dari IDN Live maupun SHOWROOM saat ini.<br>
        Anda dapat memilih member dari daftar atau memasukkan custom room ID untuk standby.
      </div>
    `;
    return;
  }

  lives.forEach(live => {
    const card = document.createElement('div');
    card.className = 'flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/50 transition cursor-pointer text-left';
    
    const badgeBg = live.platform === 'idn' ? 'badge-idn' : 'badge-sr';

    card.innerHTML = `
      <div class="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-800 border border-slate-700 shadow-md">
        <img src="${live.avatar || 'https://via.placeholder.com/80'}" class="w-full h-full object-cover">
        <span class="absolute top-1 left-1 px-1 py-0.2 rounded text-[9px] font-bold uppercase ${badgeBg}">
          ${live.platform}
        </span>
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="font-bold text-sm text-white truncate">${live.name}</h4>
        <p class="text-xs text-slate-400 truncate">${live.title || 'Sedang Live'}</p>
        <span class="text-[10px] text-emerald-400 font-medium">● ${Number(live.viewers).toLocaleString()} penonton</span>
      </div>
      <button class="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex-shrink-0 shadow transition">
        Tonton
      </button>
    `;

    card.addEventListener('click', () => {
      addStream(live);
    });

    emptyStateLives.appendChild(card);
  });
}

/**
 * Render Modal Live List
 */
function renderModalLiveList(lives) {
  const container = document.getElementById('modal-live-list');
  const empty = document.getElementById('modal-live-empty');
  if (!container || !empty) return;

  container.innerHTML = '';

  if (lives.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  lives.forEach(live => {
    const isAdded = State.activeStreams.some(s => s.id === live.id);
    const card = document.createElement('div');
    card.className = `flex items-center gap-3 p-3 rounded-xl border transition ${
      isAdded ? 'bg-rose-950/40 border-rose-600/50' : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
    }`;

    const badgeBg = live.platform === 'idn' ? 'badge-idn' : 'badge-sr';

    card.innerHTML = `
      <div class="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-800">
        <img src="${live.avatar || 'https://via.placeholder.com/80'}" class="w-full h-full object-cover">
        <span class="absolute bottom-0 right-0 px-1 text-[9px] font-bold ${badgeBg} rounded-tl">
          ${live.platform.toUpperCase()}
        </span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-bold text-xs text-white truncate">${live.name}</div>
        <div class="text-[11px] text-slate-400 truncate">${live.title}</div>
        <div class="text-[10px] text-emerald-400 mt-0.5">👥 ${Number(live.viewers).toLocaleString()}</div>
      </div>
      <button class="px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
        isAdded ? 'bg-slate-800 text-slate-400 cursor-default' : 'bg-rose-600 hover:bg-rose-500 text-white shadow'
      }">
        ${isAdded ? 'Ditonton' : '+ Tambah'}
      </button>
    `;

    if (!isAdded) {
      card.addEventListener('click', () => {
        addStream(live);
        closeModal();
      });
    }

    container.appendChild(card);
  });
}

/**
 * Render Members Roster in Modal
 */
function renderMembersRoster(members) {
  const container = document.getElementById('modal-member-roster');
  if (!container) return;
  container.innerHTML = '';

  members.forEach(member => {
    const card = document.createElement('div');
    card.className = 'flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 text-xs transition';

    card.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-200 truncate">${member.name}</div>
        <div class="text-[10px] text-slate-400 flex items-center gap-2">
          <span class="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">${member.generation}</span>
          ${member.sr_id ? `<span class="text-sky-400">SR: ${member.sr_id}</span>` : ''}
          ${member.idn_username ? `<span class="text-rose-400">IDN: @${member.idn_username}</span>` : ''}
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        ${member.sr_id ? `
          <button data-type="sr" data-id="${member.sr_id}" class="btn-roster-add px-2 py-1 rounded bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 font-medium text-[11px] transition">
            SHOWROOM
          </button>
        ` : ''}
        ${member.idn_username ? `
          <button data-type="idn" data-id="${member.idn_username}" class="btn-roster-add px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-medium text-[11px] transition">
            IDN
          </button>
        ` : ''}
      </div>
    `;

    card.querySelectorAll('.btn-roster-add').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const type = btn.getAttribute('data-type');
        const id = btn.getAttribute('data-id');
        btn.disabled = true;
        btn.textContent = 'Mengecek...';
        await resolveAndAddStream(id, member.name, type);
        btn.disabled = false;
        btn.textContent = type.toUpperCase();
        closeModal();
      });
    });

    container.appendChild(card);
  });
}

function filterMembersRoster(keyword) {
  const q = keyword.toLowerCase().trim();
  const filtered = State.allMembers.filter(m => 
    m.name.toLowerCase().includes(q) ||
    m.nick.toLowerCase().includes(q) ||
    m.generation.toLowerCase().includes(q) ||
    (m.idn_username && m.idn_username.toLowerCase().includes(q))
  );
  renderMembersRoster(filtered);
}

/**
 * Handle Custom Stream Input
 */
async function handleCustomStreamSubmit() {
  const urlInput = document.getElementById('input-custom-url');
  const nameInput = document.getElementById('input-custom-name');
  const errDiv = document.getElementById('custom-error');
  const btn = document.getElementById('btn-submit-custom');

  const query = urlInput.value.trim();
  const customName = nameInput.value.trim();

  if (!query) {
    showError(errDiv, 'Harap masukkan URL atau Room ID');
    return;
  }

  errDiv.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Menghubungkan stream...';

  try {
    const res = await fetch(`/api/resolve?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data.success) {
      showError(errDiv, data.error || 'Stream tidak ditemukan atau sedang offline.');
      btn.disabled = false;
      btn.textContent = 'Tambah Stream ke Grid';
      return;
    }

    const streamData = {
      id: data.id || `custom_${Date.now()}`,
      platform: data.platform || 'custom',
      platform_name: data.platform_name || 'Stream',
      name: customName || data.name || 'Custom Stream',
      title: data.title || '',
      avatar: data.avatar || '',
      stream_url: data.stream_url,
      raw_stream_url: data.raw_stream_url || data.stream_url,
      page_url: data.page_url || query,
      room_id: data.room_id || null
    };

    addStream(streamData);
    closeModal();
    urlInput.value = '';
    nameInput.value = '';
  } catch (err) {
    showError(errDiv, `Gagal memuat stream: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Tambah Stream ke Grid';
  }
}

async function resolveAndAddStream(query, displayName, platformHint) {
  try {
    const res = await fetch(`/api/resolve?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.success) {
      addStream({
        id: data.id || `${platformHint}_${query}`,
        platform: data.platform || platformHint,
        platform_name: data.platform_name || platformHint.toUpperCase(),
        name: displayName || data.name,
        title: data.title || '',
        avatar: data.avatar || '',
        stream_url: data.stream_url,
        page_url: data.page_url || '',
        room_id: data.room_id || query
      });
    } else {
      alert(`${displayName} sedang tidak aktif streaming saat ini.`);
    }
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

/**
 * Watch All Active Lives
 */
function watchAllLives() {
  if (State.availableLives.length === 0) {
    alert('Saat ini tidak ada member yang terdeteksi sedang live.');
    return;
  }

  State.availableLives.forEach(live => {
    if (!State.activeStreams.some(s => s.id === live.id)) {
      addStream(live);
    }
  });

  // Switch to auto layout
  setLayout('auto');
}

/**
 * Add Stream to Grid
 */
function addStream(streamData) {
  if (State.activeStreams.some(s => s.id === streamData.id)) {
    // Already in grid, highlight it
    toggleSoloAudio(streamData.id);
    return;
  }

  // Create stream object
  const stream = {
    ...streamData,
    isMuted: State.activeStreams.length > 0, // Mute if already have other stream playing
    volume: 1,
    fitMode: 'contain',
    hls: null,
    video: null,
    card: null
  };

  State.activeStreams.push(stream);

  // If first stream, make it solo audio
  if (State.activeStreams.length === 1) {
    State.soloStreamId = stream.id;
    stream.isMuted = false;
  }

  // Render Stream Card
  renderStreamCard(stream);

  // Update layout and empty state
  updateGridDisplay();
  saveSession();
  renderLiveAvatarsCarousel(State.availableLives);
}

/**
 * Render Individual Stream Card in Grid
 */
function renderStreamCard(stream) {
  const card = document.createElement('div');
  card.id = `card-${stream.id}`;
  card.className = `stream-card group ${stream.id === State.soloStreamId ? 'audio-active' : ''}`;

  const platformBadge = stream.platform === 'idn' 
    ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase badge-idn">IDN</span>'
    : '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase badge-sr">SHOWROOM</span>';

  card.innerHTML = `
    <!-- Video Element -->
    <video id="video-${stream.id}" class="stream-video" playsinline webkit-playsinline></video>

    <!-- Buffer / Loading Overlay -->
    <div id="loader-${stream.id}" class="video-loader">
      <div class="relative w-10 h-10 mb-2">
        <div class="w-full h-full rounded-full border-2 border-rose-500/20 border-t-rose-500 animate-spin"></div>
        <span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-rose-400">48</span>
      </div>
      <span class="text-xs text-slate-300 font-medium">Memuat live stream...</span>
      <span class="text-[10px] text-slate-500 mt-0.5">${stream.name}</span>
    </div>

    <!-- Top Overlay (Info & Solo/Close) -->
    <div class="stream-card-overlay">
      <div class="flex items-center gap-1.5 min-w-0 flex-1">
        <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden flex-shrink-0 bg-slate-800 border border-slate-700">
          <img src="${stream.avatar || 'https://via.placeholder.com/60'}" class="w-full h-full object-cover">
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1 min-w-0">
            <span class="font-bold text-xs text-white truncate max-w-[75px] sm:max-w-[200px]">${stream.name}</span>
            ${platformBadge}
          </div>
          ${stream.title ? `<p class="text-[9px] sm:text-[10px] text-slate-400 truncate max-w-[75px] sm:max-w-[220px]">${stream.title}</p>` : ''}
        </div>
      </div>

      <!-- Action Buttons: Solo & Close only for collision-free top overlay -->
      <div class="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        <!-- Solo Audio Button -->
        <button id="btn-solo-${stream.id}" class="btn-solo flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold transition ${
          stream.id === State.soloStreamId ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/50' : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300'
        }" title="Solo Audio: Dengarkan stream ini saja">
          <i data-lucide="headphones" class="w-3 sm:w-3.5 h-3 sm:h-3.5"></i>
          <span class="hidden sm:inline">Solo</span>
        </button>

        <!-- Close Stream -->
        <button id="btn-close-${stream.id}" class="p-1 sm:p-1.5 rounded-lg bg-slate-800/90 hover:bg-rose-600 text-slate-300 hover:text-white transition" title="Tutup Layar Ini">
          <i data-lucide="x" class="w-3 sm:w-3.5 h-3 sm:h-3.5"></i>
        </button>
      </div>
    </div>

    <!-- Bottom Overlay (Volume & Utility Controls) -->
    <div class="stream-card-controls">
      <!-- Left: Audio Controls -->
      <div class="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        <!-- Mute Button -->
        <button id="btn-mute-${stream.id}" class="p-1 sm:p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition" title="Mute/Unmute">
          <i data-lucide="${stream.isMuted ? 'volume-x' : 'volume-2'}" class="w-3.5 h-3.5"></i>
        </button>
        <!-- Volume Slider -->
        <input type="range" id="vol-${stream.id}" min="0" max="1" step="0.05" value="${stream.isMuted ? 0 : stream.volume}" class="stream-vol-slider w-14 sm:w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500">
      </div>

      <!-- Right: Utility Controls (Reload, Fit, Chat, Web, Fullscreen) -->
      <div class="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        <!-- Fit Toggle (Contain vs Cover) -->
        <button id="btn-fit-${stream.id}" class="btn-fit p-1 sm:p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition" title="Ubah Ukuran Video (Fit / Fill)">
          <i data-lucide="scaling" class="w-3 sm:w-3.5 h-3 sm:h-3.5"></i>
        </button>

        <!-- Real-Time Sync (Live Edge IDN) -->
        <button id="btn-reload-${stream.id}" class="btn-sync-live flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-rose-950/70 hover:bg-rose-900/80 border border-rose-800/50 hover:border-rose-600 text-[9px] sm:text-[10px] font-semibold text-rose-200 transition shadow-sm" title="Sinkronkan Real-Time persis seperti IDN">
          <span class="btn-sync-dot w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
          <span class="btn-sync-label font-bold text-rose-300">Live</span>
          <i data-lucide="rotate-cw" class="w-2.5 h-2.5 text-rose-400 opacity-70"></i>
        </button>

        <!-- Live Chat Toggle (If available) -->
        ${stream.room_id || stream.platform === 'showroom' ? `
          <button id="btn-chat-${stream.id}" class="btn-chat-toggle p-1 sm:p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition" title="Buka Live Chat">
            <i data-lucide="message-square" class="w-3 sm:w-3.5 h-3 sm:h-3.5"></i>
          </button>
        ` : ''}

        ${stream.page_url ? `
          <a href="${stream.page_url}" target="_blank" rel="noopener noreferrer" class="stream-web-link p-1 sm:p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition" title="Buka di Website Asli">
            <i data-lucide="external-link" class="w-3 sm:w-3.5 h-3 sm:h-3.5"></i>
          </a>
        ` : ''}

        <!-- Per Card Fullscreen -->
        <button id="btn-card-fs-${stream.id}" class="p-1 sm:p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition" title="Layar Penuh">
          <i data-lucide="maximize-2" class="w-3 sm:w-3.5 h-3 sm:h-3.5"></i>
        </button>
      </div>
    </div>
  `;

  grid.appendChild(card);
  if (window.lucide) lucide.createIcons({ root: card });

  const video = card.querySelector(`#video-${stream.id}`);
  const loader = card.querySelector(`#loader-${stream.id}`);
  stream.video = video;
  stream.card = card;

  // Initialize HLS Stream Playback
  setupPlayer(stream, video, loader);

  // Setup Card Action Listeners
  setupCardEvents(stream, card, video);
}

/**
 * Setup HLS.js Player
 */
function setupPlayer(stream, video, loader) {
  video.muted = stream.isMuted || State.masterMuted;
  video.volume = stream.volume;

  // Enforce steady 1.0x normal playback rate (prevent 2x catch-up speed)
  video.defaultPlaybackRate = 1.0;
  video.playbackRate = 1.0;
  video.addEventListener('ratechange', () => {
    if (video.playbackRate !== 1.0) {
      video.playbackRate = 1.0;
    }
  });

  // Debounced loader handling to prevent flickering on micro segment transitions
  let waitTimeout = null;
  video.addEventListener('playing', () => {
    if (waitTimeout) {
      clearTimeout(waitTimeout);
      waitTimeout = null;
    }
    loader?.classList.add('hidden');
    video.playbackRate = 1.0;
  });

  video.addEventListener('waiting', () => {
    // Only show loading spinner if stall lasts longer than 750ms
    if (waitTimeout) clearTimeout(waitTimeout);
    waitTimeout = setTimeout(() => {
      if (video.paused || video.readyState < 3) {
        loader?.classList.remove('hidden');
      }
    }, 750);
  });

  if (Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,          // AWS IVS uses 2s standard HLS segments
      backBufferLength: 15,
      maxBufferLength: 10,            // 10s buffer ahead for rock-solid playback
      maxMaxBufferLength: 20,
      liveSyncDuration: 3.5,          // ~1.7 segments target buffer (smooth & low latency)
      liveMaxLatencyDuration: 8.0,    // 8s drift ceiling to avoid constant seeking
      maxLiveSyncPlaybackRate: 1.0,   // Strict 1.0x playback rate (no 2x speedup)
      liveSyncOnStallIncrease: 1.0,
      highBufferWatchdogPeriod: 2,
      nudgeOffset: 0.2,
      nudgeMaxRetry: 5
    });

    hls.loadSource(stream.stream_url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.playbackRate = 1.0;
      video.play().catch(e => {
        console.warn('Autoplay prevented, stream muted:', e);
        video.muted = true;
        stream.isMuted = true;
        updateCardAudioUI(stream);
        video.play();
      });
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.warn('Fatal network error encountered, recovering...', data);
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.warn('Fatal media error encountered, recovering...', data);
            hls.recoverMediaError();
            break;
          default:
            console.error('Unrecoverable HLS error, destroying...', data);
            hls.destroy();
            break;
        }
      }
    });

    stream.hls = hls;

    // Monitor live latency and update button badge periodically
    if (stream.syncInterval) clearInterval(stream.syncInterval);
    stream.syncInterval = setInterval(() => {
      if (!stream.video || !stream.card) {
        clearInterval(stream.syncInterval);
        return;
      }
      updateLiveSyncIndicator(stream, stream.card);
    }, 2500);

  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Native HLS (Safari/iOS)
    video.src = stream.stream_url;
    video.addEventListener('loadedmetadata', () => {
      video.playbackRate = 1.0;
      video.play().catch(() => {
        video.muted = true;
        stream.isMuted = true;
        updateCardAudioUI(stream);
        video.play();
      });
    });
  }
}

/**
 * Update Live Indicator State (Real-Time vs Drift Warning)
 */
function updateLiveSyncIndicator(stream, card) {
  const syncBtn = card.querySelector(`#btn-reload-${stream.id}`);
  if (!syncBtn) return;
  const syncDot = syncBtn.querySelector('.btn-sync-dot');
  const syncLabel = syncBtn.querySelector('.btn-sync-label');
  if (!syncDot || !syncLabel) return;

  const video = stream.video;
  if (!video || video.paused || video.readyState < 2) return;

  let drift = 0;
  if (stream.hls && stream.hls.liveSyncPosition) {
    drift = Math.max(0, stream.hls.liveSyncPosition - video.currentTime);
  }

  // If drift is within safe live window (<= 6.0s), consider in sync
  if (drift <= 6.0) {
    syncDot.className = 'btn-sync-dot w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse';
    syncLabel.textContent = 'Live';
    syncLabel.className = 'btn-sync-label font-bold text-rose-300';
    syncBtn.className = 'btn-sync-live flex items-center gap-1 px-2 py-1 rounded-md bg-rose-950/70 hover:bg-rose-900/80 border border-rose-800/50 hover:border-rose-600 text-[10px] font-semibold text-rose-200 transition shadow-sm';
    syncBtn.title = `Real-Time Aktif (Selisih: ${drift.toFixed(1)}s dari live). Klik untuk sync ke detik terbaru.`;
  } else {
    // Drifted behind: prompt user to sync
    syncDot.className = 'btn-sync-dot w-1.5 h-1.5 rounded-full bg-amber-400';
    syncLabel.textContent = 'Sync ↻';
    syncLabel.className = 'btn-sync-label font-bold text-amber-300';
    syncBtn.className = 'btn-sync-live flex items-center gap-1 px-2 py-1 rounded-md bg-amber-950/70 hover:bg-amber-900/80 border border-amber-800/60 hover:border-amber-600 text-[10px] font-semibold text-amber-200 transition shadow-sm animate-pulse';
    syncBtn.title = `Tertinggal ${drift.toFixed(1)}s dari siaran langsung. Klik untuk melompat ke Real-Time!`;
  }
}

/**
 * Instant Real-Time Seek to Live Edge (0ms black screen, like IDN Live app)
 */
function syncStreamToRealtime(stream, card, video) {
  const syncBtn = card.querySelector(`#btn-reload-${stream.id}`);
  const syncLabel = syncBtn?.querySelector('.btn-sync-label');
  const syncDot = syncBtn?.querySelector('.btn-sync-dot');

  // Visual feedback: green ping
  if (syncDot) {
    syncDot.className = 'btn-sync-dot w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping';
  }
  if (syncLabel) {
    syncLabel.textContent = 'Syncing...';
    syncLabel.className = 'btn-sync-label font-bold text-emerald-300';
  }

  const finishSync = () => {
    setTimeout(() => {
      if (syncDot) {
        syncDot.className = 'btn-sync-dot w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse';
      }
      if (syncLabel) {
        syncLabel.textContent = 'Live';
        syncLabel.className = 'btn-sync-label font-bold text-rose-300';
      }
      if (syncBtn) {
        syncBtn.className = 'btn-sync-live flex items-center gap-1 px-2 py-1 rounded-md bg-rose-950/70 hover:bg-rose-900/80 border border-rose-800/50 hover:border-rose-600 text-[10px] font-semibold text-rose-200 transition shadow-sm';
      }
    }, 1000);
  };

  // If video is stalled or error, do clean reload
  if (!video || video.error || video.readyState === 0) {
    if (stream.hls) {
      const loader = card.querySelector(`#loader-${stream.id}`);
      loader?.classList.remove('hidden');
      stream.hls.destroy();
      setupPlayer(stream, video, loader);
    }
    finishSync();
    return;
  }

  // Instant Seek to live edge
  if (stream.hls) {
    try {
      const livePos = stream.hls.liveSyncPosition;
      if (livePos !== null && !isNaN(livePos) && livePos > 0) {
        video.currentTime = livePos;
      } else if (video.buffered && video.buffered.length > 0) {
        const edge = video.buffered.end(video.buffered.length - 1);
        video.currentTime = Math.max(0, edge - 0.5);
      }
      stream.hls.startLoad(livePos || -1);
      video.playbackRate = 1.0;
      video.play().catch(() => {});
      finishSync();
    } catch (e) {
      console.warn('Real-time sync seek error, reloading:', e);
      const loader = card.querySelector(`#loader-${stream.id}`);
      loader?.classList.remove('hidden');
      stream.hls.destroy();
      setupPlayer(stream, video, loader);
      finishSync();
    }
  } else {
    // Native HLS (Safari/iOS)
    if (video.seekable && video.seekable.length > 0) {
      video.currentTime = video.seekable.end(video.seekable.length - 1);
    }
    video.playbackRate = 1.0;
    video.play().catch(() => {});
    finishSync();
  }
}

/**
 * Setup Individual Card Events
 */
function setupCardEvents(stream, card, video) {
  // Solo Audio
  card.querySelector(`#btn-solo-${stream.id}`)?.addEventListener('click', () => {
    toggleSoloAudio(stream.id);
  });

  // Mute / Unmute
  card.querySelector(`#btn-mute-${stream.id}`)?.addEventListener('click', () => {
    stream.isMuted = !stream.isMuted;
    video.muted = stream.isMuted;
    updateCardAudioUI(stream);
  });

  // Volume Slider
  const volInput = card.querySelector(`#vol-${stream.id}`);
  volInput?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    stream.volume = val;
    video.volume = val;
    if (val > 0 && stream.isMuted) {
      stream.isMuted = false;
      video.muted = false;
    }
    updateCardAudioUI(stream);
  });

  // Fit Toggle
  card.querySelector(`#btn-fit-${stream.id}`)?.addEventListener('click', () => {
    stream.fitMode = stream.fitMode === 'contain' ? 'cover' : 'contain';
    if (stream.fitMode === 'cover') {
      video.classList.add('fit-cover');
    } else {
      video.classList.remove('fit-cover');
    }
  });

  // Real-Time Live Sync (Persis seperti di IDN)
  card.querySelector(`#btn-reload-${stream.id}`)?.addEventListener('click', () => {
    syncStreamToRealtime(stream, card, video);
  });

  // Close
  card.querySelector(`#btn-close-${stream.id}`)?.addEventListener('click', () => {
    removeStream(stream.id);
  });

  // Per Card Fullscreen
  card.querySelector(`#btn-card-fs-${stream.id}`)?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      card.requestFullscreen().catch(err => alert(err.message));
    } else {
      document.exitFullscreen();
    }
  });

  // Chat button
  card.querySelector(`#btn-chat-${stream.id}`)?.addEventListener('click', () => {
    if (State.activeStreams.length === 1) {
      State.companionCollapsed = false;
      updateCompanionPanel();
    } else {
      openChatDrawer(stream);
    }
  });
}

/**
 * Remove Stream from Grid
 */
function removeStream(streamId) {
  const index = State.activeStreams.findIndex(s => s.id === streamId);
  if (index === -1) return;

  const [removed] = State.activeStreams.splice(index, 1);

  // Clean up HLS and DOM
  if (removed.syncInterval) clearInterval(removed.syncInterval);
  if (removed.hls) removed.hls.destroy();
  if (removed.video) {
    removed.video.pause();
    removed.video.src = '';
  }
  const card = document.getElementById(`card-${streamId}`);
  card?.remove();

  // If removed stream was solo audio, pick another active stream to unmute
  if (State.soloStreamId === streamId) {
    if (State.activeStreams.length > 0) {
      toggleSoloAudio(State.activeStreams[0].id);
    } else {
      State.soloStreamId = null;
    }
  }

  updateGridDisplay();
  saveSession();
  renderLiveAvatarsCarousel(State.availableLives);
}

/**
 * Clear All Streams
 */
function clearAllStreams() {
  State.activeStreams.forEach(stream => {
    if (stream.hls) stream.hls.destroy();
    if (stream.video) {
      stream.video.pause();
      stream.video.src = '';
    }
  });
  State.activeStreams = [];
  State.soloStreamId = null;
  grid.innerHTML = '';
  updateGridDisplay();
  saveSession();
  renderLiveAvatarsCarousel(State.availableLives);
}

/**
 * Solo Audio: Mute All Others, Unmute Selected
 */
function toggleSoloAudio(streamId) {
  State.soloStreamId = streamId;

  State.activeStreams.forEach(stream => {
    const isTarget = stream.id === streamId;
    stream.isMuted = !isTarget;
    if (stream.video) {
      stream.video.muted = stream.isMuted;
    }
    updateCardAudioUI(stream);
  });

  // Highlight active solo card
  document.querySelectorAll('.stream-card').forEach(card => {
    if (card.id === `card-${streamId}`) {
      card.classList.add('audio-active');
    } else {
      card.classList.remove('audio-active');
    }
  });
}

/**
 * Master Mute Toggle
 */
function toggleMasterMute() {
  State.masterMuted = !State.masterMuted;
  const icon = document.getElementById('icon-master-mute');
  const iconMobile = document.getElementById('icon-mobile-master-mute');

  State.activeStreams.forEach(stream => {
    if (stream.video) {
      stream.video.muted = State.masterMuted ? true : stream.isMuted;
    }
    updateCardAudioUI(stream);
  });

  const iconName = State.masterMuted ? 'volume-x' : 'volume-2';
  if (icon) icon.setAttribute('data-lucide', iconName);
  if (iconMobile) iconMobile.setAttribute('data-lucide', iconName);
  if (window.lucide) lucide.createIcons();
}

/**
 * Update Card Audio Buttons and Indicators
 */
function updateCardAudioUI(stream) {
  const card = document.getElementById(`card-${stream.id}`);
  if (!card) return;

  const isSolo = stream.id === State.soloStreamId && !stream.isMuted;
  const soloBtn = card.querySelector(`#btn-solo-${stream.id}`);
  const muteBtn = card.querySelector(`#btn-mute-${stream.id}`);
  const volInput = card.querySelector(`#vol-${stream.id}`);

  if (soloBtn) {
    if (isSolo) {
      soloBtn.className = 'btn-solo flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition bg-emerald-600 text-white';
    } else {
      soloBtn.className = 'btn-solo flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition bg-slate-800/80 hover:bg-slate-700 text-slate-300';
    }
  }

  if (muteBtn) {
    muteBtn.innerHTML = `<i data-lucide="${stream.isMuted ? 'volume-x' : 'volume-2'}" class="w-4 h-4"></i>`;
    if (window.lucide) lucide.createIcons({ root: muteBtn });
  }

  if (volInput) {
    volInput.value = stream.isMuted ? 0 : stream.volume;
  }
}

/**
 * Update Grid Display and Layout
 */
function updateGridDisplay() {
  const count = State.activeStreams.length;

  if (count === 0) {
    grid.classList.add('hidden');
    emptyState.classList.remove('hidden');
    document.getElementById('single-companion-panel')?.classList.add('hidden');
    return;
  }

  grid.classList.remove('hidden');
  emptyState.classList.add('hidden');

  applyLayout(State.currentLayout, count);
  updateCompanionPanel();
}

/**
 * Update Single Stream Companion Panel
 */
function updateCompanionPanel() {
  const panel = document.getElementById('single-companion-panel');
  if (!panel) return;

  const count = State.activeStreams.length;
  if (count !== 1 || State.companionCollapsed) {
    panel.classList.add('hidden');
    panel.classList.remove('flex');
    if (State.companionInterval) {
      clearInterval(State.companionInterval);
      State.companionInterval = null;
    }
    return;
  }

  // Exactly 1 stream
  panel.classList.remove('hidden');
  panel.classList.add('flex');
  const stream = State.activeStreams[0];

  // Set avatar & info
  const avatar = document.getElementById('companion-avatar');
  if (avatar) avatar.src = stream.avatar || 'https://via.placeholder.com/60';

  const name = document.getElementById('companion-name');
  if (name) name.textContent = stream.name;

  const title = document.getElementById('companion-title');
  if (title) title.textContent = stream.title || 'Sedang Live';

  const badge = document.getElementById('companion-platform-badge');
  if (badge) {
    badge.className = `px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${stream.platform === 'idn' ? 'badge-idn' : 'badge-sr'}`;
    badge.textContent = stream.platform.toUpperCase();
  }

  const viewers = document.getElementById('companion-viewers');
  if (viewers) viewers.textContent = `● ${Number(stream.viewers || 0).toLocaleString()} penonton`;

  const link = document.getElementById('companion-link');
  if (link) link.href = stream.page_url || '#';

  // Render Other Lives Tab
  const otherLives = State.availableLives.filter(l => l.id !== stream.id);
  const otherCount = document.getElementById('companion-other-count');
  if (otherCount) otherCount.textContent = otherLives.length;

  const otherContent = document.getElementById('companion-other-content');
  if (otherContent) {
    if (otherLives.length === 0) {
      otherContent.innerHTML = '<p class="text-slate-500 text-center py-6 text-xs">Tidak ada member lain yang sedang live saat ini.</p>';
    } else {
      otherContent.innerHTML = otherLives.map(l => `
        <div class="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500/50 transition">
          <img src="${l.avatar || 'https://via.placeholder.com/50'}" class="w-10 h-10 rounded-lg object-cover">
          <div class="flex-1 min-w-0">
            <div class="font-bold text-xs text-white truncate">${l.name}</div>
            <div class="text-[10px] text-slate-400 truncate">${l.title}</div>
            <span class="text-[9px] text-emerald-400">● ${Number(l.viewers).toLocaleString()}</span>
          </div>
          <button data-add-id="${l.id}" class="btn-companion-add px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] flex-shrink-0 transition">
            + Split
          </button>
        </div>
      `).join('');

      otherContent.querySelectorAll('.btn-companion-add').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-add-id');
          const targetLive = State.availableLives.find(l => l.id === targetId);
          if (targetLive) {
            addStream(targetLive);
            setLayout('1x2');
          }
        });
      });
    }
  }

  // Handle Chat in Companion
  const chatContent = document.getElementById('companion-chat-content');
  if (chatContent) {
    if (stream.platform === 'showroom' && stream.room_id) {
      loadCompanionChat(stream.room_id);
      if (State.companionInterval) clearInterval(State.companionInterval);
      State.companionInterval = setInterval(() => {
        loadCompanionChat(stream.room_id);
      }, 4000);
    } else {
      if (State.companionInterval) {
        clearInterval(State.companionInterval);
        State.companionInterval = null;
      }
      chatContent.innerHTML = `
        <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center my-auto">
          <div class="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-2">
            <i data-lucide="message-square" class="w-5 h-5"></i>
          </div>
          <p class="font-bold text-slate-200 text-xs mb-1">Obrolan IDN Live</p>
          <p class="text-[11px] text-slate-400 mb-3">Untuk mengirim pesan dan gift langsung ke ${stream.name}:</p>
          <a href="${stream.page_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition">
            <span>Buka Chat di IDN Live</span>
            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
          </a>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ root: chatContent });
    }
  }

  if (window.lucide) lucide.createIcons({ root: panel });
}

async function loadCompanionChat(roomId) {
  const container = document.getElementById('companion-chat-content');
  if (!container) return;

  try {
    const res = await fetch(`/api/showroom/comments?roomId=${roomId}`);
    const data = await res.json();
    const comments = data.comments || [];

    if (comments.length === 0) {
      container.innerHTML = '<p class="text-slate-500 text-center py-6 text-xs">Belum ada komentar.</p>';
      return;
    }

    container.innerHTML = '';
    comments.slice(-30).forEach(c => {
      const item = document.createElement('div');
      item.className = 'flex items-start gap-2 p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60';
      item.innerHTML = `
        <div class="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-slate-800">
          <img src="${c.avatar_url || 'https://static.showroom-live.com/image/avatar/1.png'}" class="w-full h-full object-cover">
        </div>
        <div class="min-w-0 flex-1">
          <span class="font-bold text-[10px] text-slate-400">${c.name}</span>
          <p class="text-[11px] text-slate-200 break-words">${escapeHtml(c.comment)}</p>
        </div>
      `;
      container.appendChild(item);
    });

    container.scrollTop = container.scrollHeight;
  } catch (e) {
    // ignore
  }
}

/**
 * Set Layout Preset
 */
function setLayout(layoutName) {
  State.currentLayout = layoutName;
  const label = document.getElementById('label-layout');
  if (label) {
    const names = {
      'auto': 'Layout: Auto',
      '1x1': 'Layout: 1x1',
      '1x2': 'Layout: 1x2',
      '3-focus': 'Layout: 3 (T-Grid)',
      '2x2': 'Layout: 2x2',
      '3x2': 'Layout: 3x2'
    };
    label.textContent = names[layoutName] || 'Layout';
  }
  applyLayout(layoutName, State.activeStreams.length);
}

function applyLayout(layoutName, count) {
  // Remove all previous layout classes
  grid.className = 'flex-1 w-full h-full gap-2.5 min-h-[70vh] transition-all';

  if (layoutName === 'auto') {
    grid.classList.add('grid-layout-auto');
    grid.setAttribute('data-count', Math.min(count, 9));
  } else {
    grid.classList.add(`layout-${layoutName}`);
  }
}

/**
 * Fullscreen Grid Toggle
 */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(err);
    });
  } else {
    document.exitFullscreen();
  }
}

/**
 * Live Chat Drawer
 */
function openChatDrawer(stream) {
  const drawer = document.getElementById('chat-drawer');
  const title = document.getElementById('chat-title');
  const messagesContainer = document.getElementById('chat-messages');
  if (!drawer) return;

  drawer.classList.remove('translate-x-full');
  if (title) title.textContent = `Chat: ${stream.name}`;

  if (State.chatInterval) clearInterval(State.chatInterval);

  if (stream.platform === 'showroom' && stream.room_id) {
    fetchComments(stream.room_id);
    State.chatInterval = setInterval(() => {
      fetchComments(stream.room_id);
    }, 4000);
  } else {
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
          <p class="text-slate-300 font-semibold mb-2">IDN Live Chat</p>
          <p class="text-xs text-slate-400 mb-4">Untuk berinteraksi langsung di chat IDN Live, buka halaman resmi member:</p>
          <a href="${stream.page_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs">
            <span>Buka Web IDN Live</span>
            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
          </a>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ root: messagesContainer });
    }
  }
}

async function fetchComments(roomId) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;

  try {
    const res = await fetch(`/api/showroom/comments?roomId=${roomId}`);
    const data = await res.json();
    const comments = data.comments || [];

    if (comments.length === 0) {
      messagesContainer.innerHTML = '<p class="text-slate-500 text-center py-4">Belum ada komentar.</p>';
      return;
    }

    messagesContainer.innerHTML = '';
    // Show newest first or last
    comments.slice(-30).forEach(c => {
      const item = document.createElement('div');
      item.className = 'flex items-start gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60';
      item.innerHTML = `
        <div class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-slate-800">
          <img src="${c.avatar_url || 'https://static.showroom-live.com/image/avatar/1.png'}" class="w-full h-full object-cover">
        </div>
        <div class="min-w-0 flex-1">
          <span class="font-bold text-[11px] text-slate-300">${c.name}</span>
          <p class="text-xs text-slate-200 break-words">${escapeHtml(c.comment)}</p>
        </div>
      `;
      messagesContainer.appendChild(item);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } catch (err) {
    console.error('Failed to fetch comments:', err);
  }
}

function closeChatDrawer() {
  const drawer = document.getElementById('chat-drawer');
  drawer?.classList.add('translate-x-full');
  if (State.chatInterval) clearInterval(State.chatInterval);
}

/**
 * Modal Handling
 */
function openModal() {
  const modal = document.getElementById('modal-add');
  modal?.classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('modal-add');
  modal?.classList.add('hidden');
}

function setupModalTabs() {
  const tabs = [
    { btn: 'tab-btn-live', pane: 'tab-pane-live' },
    { btn: 'tab-btn-members', pane: 'tab-pane-members' },
    { btn: 'tab-btn-custom', pane: 'tab-pane-custom' }
  ];

  tabs.forEach(tab => {
    document.getElementById(tab.btn)?.addEventListener('click', () => {
      tabs.forEach(t => {
        const b = document.getElementById(t.btn);
        const p = document.getElementById(t.pane);
        if (t.btn === tab.btn) {
          b.className = 'tab-btn active px-4 py-2 border-b-2 border-rose-500 text-rose-400 font-semibold flex items-center gap-1.5';
          p.classList.remove('hidden');
        } else {
          b.className = 'tab-btn px-4 py-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-1.5';
          p.classList.add('hidden');
        }
      });
    });
  });
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

/**
 * LocalStorage Session Persistence
 */
function saveSession() {
  try {
    const list = State.activeStreams.map(s => ({
      id: s.id,
      platform: s.platform,
      platform_name: s.platform_name,
      name: s.name,
      title: s.title,
      avatar: s.avatar,
      stream_url: s.stream_url,
      page_url: s.page_url,
      room_id: s.room_id
    }));
    localStorage.setItem('jkt48_multiview_session', JSON.stringify({
      layout: State.currentLayout,
      streams: list
    }));
  } catch (e) {
    // ignore
  }
}

function restoreSavedSession() {
  try {
    const data = localStorage.getItem('jkt48_multiview_session');
    if (!data) return;
    const session = JSON.parse(data);
    if (session.layout) setLayout(session.layout);
    if (Array.isArray(session.streams) && session.streams.length > 0) {
      session.streams.forEach(s => addStream(s));
    }
  } catch (e) {
    // ignore
  }
}
