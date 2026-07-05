(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const SESSION_KEY_STORAGE = 'sukoon_derived_key';
  let supa = null;
  let currentUser = null;

  function isConfigured() {
    return !!(window.SUKOON_SUPABASE && window.SUKOON_SUPABASE.url && window.SUKOON_SUPABASE.anonKey);
  }

  function initSupabase() {
    if (!isConfigured() || !window.supabase) return null;
    return window.supabase.createClient(window.SUKOON_SUPABASE.url, window.SUKOON_SUPABASE.anonKey);
  }

  /* ============ Encryption (WebCrypto AES-GCM) ============ */
  function b64encode(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  function b64decode(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  }

  async function deriveKey(password, saltB64) {
    const enc = new TextEncoder();
    const salt = b64decode(saltB64);
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptText(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    return { iv: b64encode(iv), ciphertext: b64encode(ciphertextBuf) };
  }

  async function decryptText(key, ivB64, ciphertextB64) {
    const iv = b64decode(ivB64);
    const ciphertext = b64decode(ciphertextB64);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(plainBuf);
  }

  async function storeSessionKey(key) {
    const raw = await crypto.subtle.exportKey('raw', key);
    sessionStorage.setItem(SESSION_KEY_STORAGE, b64encode(raw));
  }
  async function loadSessionKey() {
    const b64 = sessionStorage.getItem(SESSION_KEY_STORAGE);
    if (!b64) return null;
    const raw = b64decode(b64);
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
  }

  let encryptionKey = null;

  /* ============ Profiles and Auth ============ */
  async function ensureProfile(userId) {
    const { data } = await supa.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) return data;
    const salt = b64encode(crypto.getRandomValues(new Uint8Array(16)));
    const { data: created } = await supa.from('profiles').insert({ id: userId, kdf_salt: salt }).select().single();
    return created;
  }

  async function recordVisit(profile) {
    await supa.from('profiles').update({
      visit_count: (profile.visit_count || 0) + 1,
      last_visit_at: new Date().toISOString(),
    }).eq('id', profile.id);
  }

  async function handleAuthed(user, password) {
    currentUser = user;
    const profile = await ensureProfile(user.id);
    encryptionKey = await deriveKey(password, profile.kdf_salt);
    await storeSessionKey(encryptionKey);
    await recordVisit(profile);
    showAtticApp(profile);
  }

  function initAuthForm() {
    const form = $('#auth-form');
    const emailInput = $('#auth-email');
    const passwordInput = $('#auth-password');
    const modeToggle = $('#auth-mode-toggle');
    const submitBtn = $('#auth-submit');
    const statusEl = $('#auth-status');
    let mode = 'signin';

    if (!form) return;

    modeToggle.addEventListener('click', () => {
      mode = mode === 'signin' ? 'signup' : 'signin';
      submitBtn.textContent = mode === 'signin' ? 'Come in' : 'Create my Attic';
      modeToggle.textContent = mode === 'signin' ? "New here? Create an account instead" : 'Already have an account? Sign in instead';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.textContent = 'One moment…';
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      try {
        if (mode === 'signup') {
          const { data, error } = await supa.auth.signUp({ email, password });
          if (error) throw error;
          if (!data.session) {
            statusEl.textContent = 'Check your email to confirm your account, then sign in.';
            return;
          }
          await handleAuthed(data.user, password);
        } else {
          const { data, error } = await supa.auth.signInWithPassword({ email, password });
          if (error) throw error;
          await handleAuthed(data.user, password);
        }
      } catch (err) {
        statusEl.textContent = err.message || 'Something went wrong. Please try again.';
      }
    });
  }

  function showAtticApp(profile) {
    $('#attic-locked').classList.add('hidden');
    $('#attic-app').classList.remove('hidden');
    
    const countEl = $('#growth-count');
    if (countEl) countEl.textContent = profile.visit_count || 1;

    // Show sign out btn in header
    const signOutBtn = $('#attic-signout');
    if (signOutBtn) signOutBtn.classList.remove('hidden');

    loadEntries();
  }

  function initSignOut() {
    const btn = $('#attic-signout');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
      encryptionKey = null;
      currentUser = null;
      await supa.auth.signOut();
      location.reload();
    });
  }

  /* ============ Keepsake Box Encrypted Entry List ============ */
  async function loadEntries() {
    const list = $('#keepsake-list');
    if (!list) return;
    list.innerHTML = '<p class="fineprint">Opening the box…</p>';
    
    const { data, error } = await supa.from('entries').select('*').order('created_at', { ascending: false });
    
    if (error) { 
      list.innerHTML = `<p class="fineprint">Couldn't load entries: ${error.message}</p>`; 
      return; 
    }
    
    if (!data.length) { 
      list.innerHTML = '<p class="fineprint">Nothing kept yet. Whatever you write down remains private to you.</p>'; 
      return; 
    }

    const rows = await Promise.all(data.map(async (row) => {
      try {
        const plain = await decryptText(encryptionKey, row.iv, row.ciphertext);
        return { id: row.id, date: row.created_at, text: plain };
      } catch (e) {
        return { id: row.id, date: row.created_at, text: '[could not decrypt with this session\'s key]' };
      }
    }));

    list.innerHTML = rows.map(r => `
      <div class="entry-row" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding:16px 0; gap:12px;">
        <div style="flex:1;">
          <div class="entry-meta" style="font-size:0.8rem; color:var(--ink-faint);">${new Date(r.date).toLocaleString()}</div>
          <div style="font-size:1.02rem; color:var(--ink); margin-top:4px; white-space:pre-wrap;">${r.text}</div>
        </div>
        <button class="entry-delete btn btn-ghost" data-id="${r.id}" style="padding:6px; min-height:36px; min-width:36px; font-size:0.85rem;">Let this go</button>
      </div>
    `).join('');

    $$('.entry-delete', list).forEach(btn => {
      btn.addEventListener('click', async () => {
        await supa.from('entries').delete().eq('id', btn.dataset.id);
        loadEntries();
      });
    });
  }

  function initKeepsakeForm() {
    const textarea = $('#keepsake-input');
    const saveBtn = $('#keepsake-save');
    if (!textarea || !saveBtn) return;
    
    saveBtn.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) return;
      
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      try {
        const { iv, ciphertext } = await encryptText(encryptionKey, text);
        await supa.from('entries').insert({ user_id: currentUser.id, iv, ciphertext });
        textarea.value = '';
        loadEntries();
      } catch (e) {
        console.error(e);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save to my Keepsake Box';
      }
    });
  }

  /* ============ Dust Particles Animation (Calmed down) ============ */
  function initDustParticles() {
    const canvas = $('#dust-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = canvas.offsetWidth || window.innerWidth);
    let height = (canvas.height = canvas.offsetHeight || window.innerHeight);

    window.addEventListener('resize', () => {
      width = (canvas.width = canvas.offsetWidth || window.innerWidth);
      height = (canvas.height = canvas.offsetHeight || window.innerHeight);
    });

    const particles = [];
    const maxParticles = 15; // Reduced density

    for (let i = 0; i < maxParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1 + Math.random() * 1.5,
        vx: -0.05 + Math.random() * 0.1, // Slower drift
        vy: -0.02 + Math.random() * 0.08,
        op: 0.05 + Math.random() * 0.25
      });
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      const freeze = localStorage.getItem('thermostat_freeze_bg') === 'true' || 
                     localStorage.getItem('thermostat_no_animations') === 'true';

      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(217, 195, 168, ${p.op})`;
        ctx.fill();

        if (!freeze) {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        }
      });

      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ============ Page Init ============ */
  document.addEventListener('DOMContentLoaded', async () => {
    initDustParticles();

    if (!isConfigured()) {
      const note = $('#attic-not-connected');
      if (note) note.classList.remove('hidden');
      const locked = $('#attic-locked');
      if (locked) locked.classList.add('hidden');
      return;
    }

    supa = initSupabase();
    initAuthForm();
    initSignOut();
    initKeepsakeForm();

    const { data: { session } } = await supa.auth.getSession();
    if (session) {
      const key = await loadSessionKey();
      if (key) {
        encryptionKey = key;
        currentUser = session.user;
        const profile = await ensureProfile(session.user.id);
        showAtticApp(profile);
      } else {
        await supa.auth.signOut();
      }
    }
  });
})();
