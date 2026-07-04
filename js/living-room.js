(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let supa = null;

  function isConfigured() {
    return !!(window.SUKOON_SUPABASE && window.SUKOON_SUPABASE.url && window.SUKOON_SUPABASE.anonKey);
  }

  // Same lightweight, non-exhaustive safety net used elsewhere in this build.
  // A concerning post is still stored (so it isn't silently lost) but is
  // always auto_flagged and never auto-approved for public display.
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
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = ctx || new AudioCtx();
        const gain = ctx.createGain();
        gain.gain.value = 0.05;
        gain.connect(ctx.destination);
        osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 80; // low, weighted hum
        osc.connect(gain);
        osc.start();
      }
      btn.dataset.active = 'true';
      btn.textContent = 'Set the blanket down';
      stage.classList.add('is-active');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeavyBlanket();
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
