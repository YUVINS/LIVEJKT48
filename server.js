const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load member roster
let memberList = [];
try {
  const data = fs.readFileSync(path.join(__dirname, 'members.json'), 'utf8');
  memberList = JSON.parse(data);
} catch (e) {
  console.error('Failed to load members.json:', e);
}

// Map for quick member lookup
const memberBySrId = new Map(memberList.map(m => [m.sr_id, m]));
const memberBySrKey = new Map(memberList.map(m => [(m.sr_key || '').toLowerCase(), m]));
const memberByIdnUser = new Map(memberList.map(m => [(m.idn_username || '').toLowerCase(), m]));

/**
 * Fetch IDN Live streams
 */
async function fetchIdnLives() {
  const query = `
    query {
      getLivestreams {
        slug
        title
        image_url
        view_count
        playback_url
        room_identifier
        status
        live_at
        creator {
          uuid
          username
          name
          avatar
        }
      }
    }
  `;

  try {
    const res = await fetch('https://api.idn.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) return [];

    const json = await res.json();
    const streams = json.data?.getLivestreams || [];

    // Filter for JKT48 streams
    const jktStreams = streams.filter(s => {
      const uname = (s.creator?.username || '').toLowerCase();
      const name = (s.creator?.name || '').toLowerCase();
      const title = (s.title || '').toLowerCase();
      return (
        uname.includes('jkt48') ||
        name.includes('jkt48') ||
        title.includes('jkt48') ||
        memberByIdnUser.has(uname)
      );
    });

    return jktStreams.map(s => {
      const member = memberByIdnUser.get((s.creator?.username || '').toLowerCase());
      const rawPlayback = s.playback_url;
      const proxyUrl = `/api/proxy/idn?url=${encodeURIComponent(rawPlayback)}`;

      return {
        id: `idn_${s.slug}`,
        platform: 'idn',
        platform_name: 'IDN Live',
        name: s.creator?.name || (member ? member.name : 'JKT48 Member'),
        member_nick: member ? member.nick : (s.creator?.name || '').replace(/jkt48/i, '').trim(),
        username: s.creator?.username,
        title: s.title,
        avatar: s.creator?.avatar || s.image_url,
        cover: s.image_url,
        viewers: s.view_count || 0,
        live_at: s.live_at,
        stream_url: proxyUrl,
        raw_stream_url: rawPlayback,
        page_url: `https://www.idn.app/${s.creator?.username}/live/${s.slug}`,
        slug: s.slug
      };
    });
  } catch (err) {
    console.error('Error fetching IDN lives:', err.message);
    return [];
  }
}

/**
 * Fetch SHOWROOM lives
 */
async function fetchShowroomLives() {
  try {
    const res = await fetch('https://www.showroom-live.com/api/live/onlives', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) return [];

    const data = await res.json();
    const genres = data.onlives || [];
    const allLives = [];

    // Extract all lives across genres
    for (const g of genres) {
      if (Array.isArray(g.lives)) {
        for (const l of g.lives) {
          allLives.push(l);
        }
      }
    }

    // Filter JKT48 Showroom rooms
    const jktLives = allLives.filter(l => {
      const roomKey = (l.room_url_key || '').toLowerCase();
      const mainName = (l.main_name || '').toLowerCase();
      const telop = (l.telop || '').toLowerCase();
      return (
        roomKey.includes('jkt48') ||
        mainName.includes('jkt48') ||
        telop.includes('jkt48') ||
        memberBySrId.has(l.room_id) ||
        memberBySrKey.has(roomKey)
      );
    });

    const results = [];
    for (const l of jktLives) {
      const member = memberBySrId.get(l.room_id) || memberBySrKey.get((l.room_url_key || '').toLowerCase());
      
      // Extract best HLS stream URL
      let hlsUrl = '';
      if (Array.isArray(l.streaming_url_list)) {
        const hlsAll = l.streaming_url_list.find(s => s.type === 'hls_all');
        const hls = l.streaming_url_list.find(s => s.type === 'hls');
        hlsUrl = (hlsAll || hls || l.streaming_url_list[0])?.url || '';
      }

      // If stream URL is not present in onlive object, fetch it
      if (!hlsUrl) {
        try {
          const sRes = await fetch(`https://www.showroom-live.com/api/live/streaming_url?room_id=${l.room_id}`, {
            signal: AbortSignal.timeout(3000)
          });
          const sData = await sRes.json();
          const list = sData.streaming_url_list || [];
          const hlsAll = list.find(s => s.type === 'hls_all');
          const hls = list.find(s => s.type === 'hls');
          hlsUrl = (hlsAll || hls || list[0])?.url || '';
        } catch (e) {
          // ignore error
        }
      }

      if (hlsUrl) {
        results.push({
          id: `sr_${l.room_id}`,
          platform: 'showroom',
          platform_name: 'SHOWROOM',
          name: member ? member.name : l.main_name,
          member_nick: member ? member.nick : l.main_name.replace(/jkt48/i, '').trim(),
          username: l.room_url_key,
          title: l.telop || l.main_name,
          avatar: l.image_square || l.image,
          cover: l.image,
          viewers: l.view_num || 0,
          live_at: l.started_at ? new Date(l.started_at * 1000).toISOString() : new Date().toISOString(),
          stream_url: hlsUrl,
          raw_stream_url: hlsUrl,
          page_url: `https://www.showroom-live.com/${l.room_url_key}`,
          room_id: l.room_id
        });
      }
    }

    return results;
  } catch (err) {
    console.error('Error fetching Showroom lives:', err.message);
    return [];
  }
}

/**
 * Endpoint: /api/lives
 * Combines active IDN and SHOWROOM live streams
 */
app.get('/api/lives', async (req, res) => {
  try {
    const [idn, showroom] = await Promise.all([
      fetchIdnLives(),
      fetchShowroomLives()
    ]);

    const all = [...idn, ...showroom];

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      counts: {
        total: all.length,
        idn: idn.length,
        showroom: showroom.length
      },
      lives: all,
      by_platform: {
        idn,
        showroom
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Endpoint: /api/proxy/idn
 * Proxies IDN Live m3u8 playlists, injecting headers and rewriting URLs to bypass CORS.
 */
app.get('/api/proxy/idn', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Origin': 'https://www.idn.app',
        'Referer': 'https://www.idn.app/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch target: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // If m3u8 playlist, rewrite manifest links
    if (targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL')) {
      const bodyText = await response.text();
      const baseUrl = new URL(targetUrl);

      const rewritten = bodyText.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;

        try {
          const resolved = new URL(trimmed, baseUrl).href;
          // Rewrite child playlists through proxy
          if (resolved.includes('.m3u8')) {
            return `/api/proxy/idn?url=${encodeURIComponent(resolved)}`;
          }
          // .ts segments are absolute with CORS: * so return direct URL
          return resolved;
        } catch {
          return line;
        }
      }).join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(rewritten);
    }

    // For non-playlist responses (segments or binary data)
    res.setHeader('Content-Type', contentType || 'video/MP2T');
    const arrayBuffer = await response.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).send(`Proxy Error: ${err.message}`);
  }
});

/**
 * Endpoint: /api/showroom/stream
 * Resolves SHOWROOM stream URLs for a given room_id
 */
app.get('/api/showroom/stream', async (req, res) => {
  const roomId = req.query.roomId;
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

  try {
    const sRes = await fetch(`https://www.showroom-live.com/api/live/streaming_url?room_id=${roomId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const data = await sRes.json();
    const list = data.streaming_url_list || [];
    const hlsAll = list.find(s => s.type === 'hls_all');
    const hls = list.find(s => s.type === 'hls');
    const selected = (hlsAll || hls || list[0])?.url || '';

    res.json({
      success: true,
      roomId,
      selected_url: selected,
      streams: list
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: /api/showroom/comments
 * Fetches real-time chat log from SHOWROOM
 */
app.get('/api/showroom/comments', async (req, res) => {
  const roomId = req.query.roomId;
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

  try {
    const response = await fetch(`https://www.showroom-live.com/api/live/comment_log?room_id=${roomId}`);
    const data = await response.json();
    res.json({
      success: true,
      comments: data.comment_log || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: /api/members
 * Returns full JKT48 member roster
 */
app.get('/api/members', (req, res) => {
  res.json({
    success: true,
    total: memberList.length,
    members: memberList
  });
});

/**
 * Endpoint: /api/resolve
 * Resolves a custom input URL or Room ID / Slug to a playable stream
 */
app.get('/api/resolve', async (req, res) => {
  const input = (req.query.q || '').trim();
  if (!input) return res.status(400).json({ error: 'Empty query' });

  try {
    // 1. Direct m3u8
    if (input.includes('.m3u8')) {
      const isIdn = input.includes('live-video.net') || input.includes('idn');
      return res.json({
        success: true,
        type: 'm3u8',
        name: 'Custom Stream',
        platform: isIdn ? 'idn' : 'custom',
        stream_url: isIdn ? `/api/proxy/idn?url=${encodeURIComponent(input)}` : input
      });
    }

    // 2. IDN URL (e.g., https://www.idn.app/jkt48_lia/live/ayo-ngobrol-bareng-261108121216 or slug)
    if (input.includes('idn.app') || input.startsWith('jkt48_') || input.includes('-26')) {
      let slug = input;
      if (input.includes('/live/')) {
        slug = input.split('/live/')[1].split('?')[0].split('/')[0];
      }

      // Query GraphQL for this slug
      const idnLives = await fetchIdnLives();
      const match = idnLives.find(s => s.slug === slug || input.includes(s.slug) || (s.username && input.includes(s.username)));
      if (match) {
        return res.json({ success: true, ...match });
      }

      // Try searching IDN live streams
      return res.status(404).json({ error: 'Live stream IDN tidak ditemukan atau sudah selesai.' });
    }

    // 3. Showroom Room ID or key
    let roomId = input;
    if (input.includes('showroom-live.com/')) {
      const key = input.split('showroom-live.com/')[1].split('?')[0].split('/')[0];
      const member = memberBySrKey.get(key.toLowerCase());
      if (member) roomId = member.sr_id;
      else {
        // Fetch room profile to get room_id
        const pRes = await fetch(`https://www.showroom-live.com/api/room/profile?room_url_key=${key}`);
        const pData = await pRes.json();
        if (pData.room_id) roomId = pData.room_id;
      }
    }

    if (/^\d+$/.test(roomId)) {
      const sRes = await fetch(`https://www.showroom-live.com/api/live/streaming_url?room_id=${roomId}`);
      const sData = await sRes.json();
      const list = sData.streaming_url_list || [];
      const hls = list.find(s => s.type === 'hls_all') || list.find(s => s.type === 'hls') || list[0];
      if (hls) {
        const member = memberBySrId.get(parseInt(roomId));
        return res.json({
          success: true,
          platform: 'showroom',
          platform_name: 'SHOWROOM',
          name: member ? member.name : `Room ${roomId}`,
          room_id: roomId,
          stream_url: hls.url,
          raw_stream_url: hls.url
        });
      }
    }

    return res.status(404).json({ error: 'Stream tidak ditemukan atau tidak sedang live.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`  JKT48 MULTI-VIEW LIVE STREAMING SERVER`);
  console.log(`  Platform: IDN Live & SHOWROOM`);
  console.log(`  Running on: http://localhost:${PORT}`);
  console.log(`=================================================\n`);
});
