(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let supa = null;

  function isConfigured() {
    return !!(window.SUKOON_SUPABASE && window.SUKOON_SUPABASE.url && window.SUKOON_SUPABASE.anonKey);
  }

  const CONCERN_WORDS = [
    'kill myself', 'suicide', 'want to die', 'end my life', 'hurt myself',
    'kill him', 'kill her', 'kill them', 'hurt someone',
  ];
  function looksConcerning(text) {
    const lower = text.toLowerCase();
    return CONCERN_WORDS.some(w => lower.includes(w));
  }

  /* ============ The Shared Couch ============ */
  async function loadPosts() {
    const feed = $('#couch-feed');
    if (!feed) return;
    feed.innerHTML = '<p class="fineprint">Settling onto the couch…</p>';
    const { data, error } = await supa
      .from('posts')
      .select('*')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) { feed.innerHTML = `<p class="fineprint">Couldn't load the couch right now.</p>`; return; }
    if (!data.length) { feed.innerHTML = '<p class="fineprint">No stories are sitting here yet. Yours could be the first.</p>'; return; }

    const litKey = 'sukoon_lit_posts';
    const lit = new Set(JSON.parse(localStorage.getItem(litKey) || '[]'));

    feed.innerHTML = data.map(p => `
      <div class="couch-post">
        <p>${p.body}</p>
        <button class="light-btn ${lit.has(p.id) ? 'lit' : ''}" data-id="${p.id}" ${lit.has(p.id) ? 'disabled' : ''}>
          <span aria-hidden="true">🕯️</span> <span class="light-count">${p.lights}</span> light${p.lights === 1 ? '' : 's'} left on
        </button>
      </div>
    `).join('');

    $$('.light-btn', feed).forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const { data: newCount, error: rpcErr } = await supa.rpc('increment_light', { post_id: id });
        if (rpcErr) return;
        btn.querySelector('.light-count').textContent = newCount;
        btn.classList.add('lit');
        btn.disabled = true;
        const litSet = new Set(JSON.parse(localStorage.getItem(litKey) || '[]'));
        litSet.add(id);
        localStorage.setItem(litKey, JSON.stringify([...litSet]));
      });
    });
  }

  function initShareForm() {
    const form = $('#couch-share-form');
    if (!form) return;
    const textarea = $('#couch-share-text');
    const status = $('#couch-share-status');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = textarea.value.trim();
      if (!body) return;
      status.textContent = 'Sharing…';

      const flagged = looksConcerning(body);
      const { data: { user } } = await supa.auth.getUser();

      const { error } = await supa.from('posts').insert({
        author_id: user ? user.id : null,
        body,
        approved: false,
        auto_flagged: flagged,
      });

      if (error) {
        status.textContent = user
          ? "Couldn't share that just now."
          : 'Sharing anonymously requires being signed in to the Attic first, so posts can be moderated fairly.';
        return;
      }

      textarea.value = '';
      status.textContent = flagged
        ? "Thank you for sharing. Because of what you wrote, this will be reviewed with extra care before it appears, and it's worth also visiting the Porch Light if things feel heavy right now."
        : "Thank you for sharing. It'll appear on the couch once it's been gently reviewed.";
    });
  }

  /* ============ The Heavy Blanket ============ */
  function initHeavyBlanket() {
    const btn = $('#blanket-start');
    if (!btn) return;
    const stage = $('#blanket-stage');
    let ctx = null;
    let osc = null;

    btn.addEventListener('click', () => {
      const active = btn.dataset.active === 'true';
      if (active) {
        if (osc) { try { osc.stop(); } catch (e) {} }
        btn.dataset.active = 'false';
        btn.textContent = 'Wrap me up';
        stage.classList.remove('is-active');
        return;
      }

      // Check if audio is muted in the thermostat
      if (localStorage.getItem('thermostat_mute_audio') === 'true') {
        btn.textContent = '🔇 Muted in Settings';
        setTimeout(() => { btn.textContent = 'Wrap me up'; }, 1500);
        return;
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = ctx || new AudioCtx();
        const gain = ctx.createGain();
        gain.gain.value = 0.04;
        gain.connect(ctx.destination);
        osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 75; // low, weighted hum
        osc.connect(gain);
        osc.start();
      }
      btn.dataset.active = 'true';
      btn.textContent = 'Set the blanket down';
      stage.classList.add('is-active');
    });
  }

  /* ============ Companion Chat Flow (v4) ============ */
  function initCompanionChat() {
    const urlParams = new URLSearchParams(window.location.search);
    const activeEmotion = urlParams.get('emotion');
    const companionSpace = $('#companion-space');
    if (!companionSpace) return;

    if (!activeEmotion) {
      companionSpace.classList.add('hidden');
      return;
    }

    companionSpace.classList.remove('hidden');

    const log = $('#companion-chat-log');
    const input = $('#companion-input');
    const sendBtn = $('#companion-send');
    const finishBtn = $('#companion-finish');
    const typing = $('#companion-typing');
    const ratingSpace = $('#reflection-rating');

    // Add greeting (implementing Emotional Memory opt-in)
    let greeting = 'You sound tired. Let’s not rush this.';
    const weatherHistory = JSON.parse(localStorage.getItem('sukoon_weather_history') || '[]');
    const feltBefore = weatherHistory.some(w => w.emotion === activeEmotion);
    if (feltBefore) {
      greeting += ' I remember this feeling visiting before.';
    }
    appendBubble('companion', greeting);

    function appendBubble(sender, text) {
      const b = document.createElement('div');
      b.className = `chat-bubble ${sender}`;
      b.textContent = text;
      log.appendChild(b);
      log.scrollTop = log.scrollHeight;
    }

    // Accidental exit draft handling
    input.addEventListener('input', () => {
      window.Sukoon.saveDraft(input.value);
    });

    document.addEventListener('sukoon-restore-draft', (e) => {
      if (e.detail) {
        input.value = e.detail;
      }
    });

    async function handleSend() {
      const text = input.value.trim();
      if (!text) return;

      appendBubble('user', text);
      input.value = '';
      window.Sukoon.clearDraft(); // clear since sent
      sendBtn.disabled = true;
      typing.classList.remove('hidden');

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'companion',
            payload: {
              emotion: activeEmotion,
              journalText: text
            }
          })
        });
        const data = await res.json();
        typing.classList.add('hidden');
        if (data.ok && data.data && data.data.text) {
          appendBubble('companion', data.data.text);
        } else {
          appendBubble('companion', 'I spent a little time with your words. Thank you for sharing them.');
        }
      } catch (e) {
        typing.classList.add('hidden');
        appendBubble('companion', 'I spent a little time with your words. Thank you for trusting this space.');
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSend();
    });

    finishBtn.addEventListener('click', () => {
      companionSpace.classList.add('hidden');
      ratingSpace.classList.remove('hidden');
      window.Sukoon.clearDraft();
    });

    // Rating selections
    $$('.weather-rating-card', ratingSpace).forEach(card => {
      card.addEventListener('click', () => {
        const weather = card.dataset.weather;
        saveWeatherRating(activeEmotion || 'Living Room', weather);

        ratingSpace.innerHTML = `
          <div class="card">
            <h2 class="display-sm" style="font-size:1.2rem; margin-bottom:12px;">Thank you for reflecting with me.</h2>
            <p class="lede lede-sm">Some thoughts aren't meant to be carried forever. I hope you feel a little lighter now.</p>
            <button class="btn btn-primary" id="done-ref-btn" style="margin-top:16px;">Finish</button>
          </div>
        `;
        
        $('#done-ref-btn').addEventListener('click', () => {
          // Clear query params and refresh
          window.location.href = window.location.pathname;
        });
      });
    });

    const closeBtn = $('#rating-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.location.href = window.location.pathname;
      });
    }
  }

  function saveWeatherRating(emotion, weather) {
    const list = JSON.parse(localStorage.getItem('sukoon_weather_history') || '[]');
    list.push({
      date: new Date().toISOString(),
      room: 'Living Room',
      emotion: emotion,
      weather: weather
    });
    localStorage.setItem('sukoon_weather_history', JSON.stringify(list));

    // Water plant
    let plantVisits = parseInt(localStorage.getItem('sukoon_plant_visits') || '0', 10);
    localStorage.setItem('sukoon_plant_visits', plantVisits + 1);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeavyBlanket();
    initCompanionChat();
    if (!isConfigured() || !window.supabase) {
      const note = document.getElementById('living-room-not-connected');
      if (note) note.classList.remove('hidden');
      return;
    }
    supa = window.supabase.createClient(window.SUKOON_SUPABASE.url, window.SUKOON_SUPABASE.anonKey);
    loadPosts();
    initShareForm();
  });
})();
