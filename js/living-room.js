(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let supa = null;

  function isConfigured() {
    return !!(window.SUKOON_SUPABASE && window.SUKOON_SUPABASE.url && window.SUKOON_SUPABASE.anonKey);
  }

  function initSupabase() {
    if (!isConfigured() || !window.supabase) return null;
    return window.supabase.createClient(window.SUKOON_SUPABASE.url, window.SUKOON_SUPABASE.anonKey);
  }

  async function loadFeed() {
    const feedEl = $('#couch-feed');
    if (!feedEl) return;

    feedEl.innerHTML = '<p class="fineprint">Adjusting cushions…</p>';

    const { data, error } = await supa
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      feedEl.innerHTML = `<p class="fineprint">Couldn't load shared notes: ${error.message}</p>`;
      return;
    }

    if (!data.length) {
      feedEl.innerHTML = '<p class="fineprint">The couch is empty. Be the first to leave a comforting note.</p>';
      return;
    }

    feedEl.innerHTML = data.map(post => `
      <div class="card" style="background: var(--surface-soft); padding: 24px; border: 1px solid var(--line); border-radius: var(--radius-md); text-align: left;">
        <p style="font-size: 1.02rem; line-height: 1.6; color: var(--ink); font-style: italic;">"${post.content}"</p>
        <div class="entry-meta" style="margin-top: 10px; font-size: 0.8rem; color: var(--ink-faint);">${new Date(post.created_at).toLocaleDateString()}</div>
      </div>
    `).join('');
  }

  function initCouchForm() {
    const form = $('#couch-share-form');
    const input = $('#couch-share-text');
    const status = $('#couch-share-status');
    if (!form || !input) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = input.value.trim();
      if (!content) return;

      status.textContent = 'Leaving note…';
      
      const { error } = await supa.from('posts').insert({ content });

      if (error) {
        status.textContent = `Couldn't save: ${error.message}`;
      } else {
        input.value = '';
        status.textContent = 'Note left anonymously.';
        setTimeout(() => { status.textContent = ''; }, 3000);
        loadFeed();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!isConfigured()) {
      const note = $('#living-room-not-connected');
      if (note) note.classList.remove('hidden');
      return;
    }

    supa = initSupabase();
    initCouchForm();
    loadFeed();
  });
})();
