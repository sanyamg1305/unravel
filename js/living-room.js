(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // A warm, curated set of anonymous notes from other passersby to remind users they are not alone.
  const STATIC_STORIES = [
    { content: "I didn't think I'd make it through last autumn, but here I am, watching the leaves grow back. You are stronger than you think.", created_at: "2026-06-28T10:00:00.000Z" },
    { content: "It's okay to feel scattered. You are allowed to take up space even when you don't have it all figured out.", created_at: "2026-07-01T14:30:00.000Z" },
    { content: "To whoever is reading this: I spent last night crying on my kitchen floor. Tonight, I made tea. Things change, even if they move slowly.", created_at: "2026-07-03T18:15:00.000Z" },
    { content: "You are not a burden. Your feelings are real, and they deserve to be held.", created_at: "2026-07-04T09:45:00.000Z" },
    { content: "I'm sitting in a quiet room writing this, wishing you peace. You are not alone.", created_at: "2026-07-05T08:20:00.000Z" }
  ];

  function loadFeed() {
    const feedEl = $('#couch-feed');
    if (!feedEl) return;

    // Load local client posts
    const localPosts = JSON.parse(localStorage.getItem('sukoon_couch_posts') || '[]');

    // Combine static comfort stories and user's offline notes
    const combined = [...localPosts, ...STATIC_STORIES];

    // Sort newest first
    combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    feedEl.innerHTML = combined.map(post => `
      <div class="card" style="background: var(--surface-soft); padding: 24px; border: 1px solid var(--line); border-radius: var(--radius-md); text-align: left;">
        <p style="font-size: 1.05rem; line-height: 1.6; color: var(--ink); font-style: italic;">"${post.content}"</p>
        <div class="entry-meta" style="margin-top: 10px; font-size: 0.8rem; color: var(--ink-faint);">${new Date(post.created_at).toLocaleDateString()} — Anonymous Passerby</div>
      </div>
    `).join('');
  }

  function initCouchForm() {
    const form = $('#couch-share-form');
    const input = $('#couch-share-text');
    const status = $('#couch-share-status');
    if (!form || !input) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const content = input.value.trim();
      if (!content) return;

      status.textContent = 'Leaving note on the couch…';
      
      const localPosts = JSON.parse(localStorage.getItem('sukoon_couch_posts') || '[]');
      localPosts.push({
        content,
        created_at: new Date().toISOString()
      });
      localStorage.setItem('sukoon_couch_posts', JSON.stringify(localPosts));

      input.value = '';
      status.textContent = 'Note left anonymously on your couch.';
      setTimeout(() => { status.textContent = ''; }, 3000);
      loadFeed();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initCouchForm();
    loadFeed();
  });
})();
