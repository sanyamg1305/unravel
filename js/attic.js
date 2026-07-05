(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const SESSION_KEY_STORAGE = 'sukoon_derived_key';
  let encryptionKey = null;

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
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
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

  /* ============ Local Unlock & Auth ============ */
  async function handleUnlock(passphrase) {
    let salt = localStorage.getItem('sukoon_keepsake_salt');
    if (!salt) {
      salt = b64encode(crypto.getRandomValues(new Uint8Array(16)));
      localStorage.setItem('sukoon_keepsake_salt', salt);
    }

    try {
      encryptionKey = await deriveKey(passphrase, salt);
      await storeSessionKey(encryptionKey);
      
      // Let's verify we can decrypt a test string to check if the password is correct!
      const testEnc = localStorage.getItem('sukoon_keepsake_test');
      if (testEnc) {
        const { iv, ciphertext } = JSON.parse(testEnc);
        await decryptText(encryptionKey, iv, ciphertext);
      } else {
        // Create a new test payload to verify password next time
        const payload = await encryptText(encryptionKey, 'verify-success');
        localStorage.setItem('sukoon_keepsake_test', JSON.stringify(payload));
      }

      // Record visit count locally
      let visits = parseInt(localStorage.getItem('sukoon_attic_visits') || '0', 10);
      localStorage.setItem('sukoon_attic_visits', visits + 1);

      showAtticApp();
    } catch (err) {
      $('#auth-status').textContent = 'Incorrect passphrase. Please try again.';
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
      encryptionKey = null;
    }
  }

  function initAuthForm() {
    const form = $('#auth-form');
    const passwordInput = $('#auth-password');
    const statusEl = $('#auth-status');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.textContent = 'Unlocking Box…';
      const password = passwordInput.value;
      await handleUnlock(password);
    });
  }

  function showAtticApp() {
    $('#attic-locked').classList.add('hidden');
    $('#attic-app').classList.remove('hidden');
    
    const countEl = $('#growth-count');
    const visits = localStorage.getItem('sukoon_attic_visits') || '1';
    if (countEl) countEl.textContent = visits;

    // Show lock box button in header
    const signOutBtn = $('#attic-signout');
    if (signOutBtn) {
      signOutBtn.classList.remove('hidden');
      signOutBtn.textContent = 'Lock Box';
    }

    loadEntries();
  }

  function initSignOut() {
    const btn = $('#attic-signout');
    if (!btn) return;
    btn.addEventListener('click', () => {
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
      encryptionKey = null;
      location.reload();
    });
  }

  /* ============ Keepsake Box Encrypted Entry List ============ */
  async function loadEntries() {
    const list = $('#keepsake-list');
    if (!list) return;
    list.innerHTML = '<p class="fineprint">Opening the box…</p>';
    
    const rawData = localStorage.getItem('sukoon_keepsakes') || '[]';
    const data = JSON.parse(rawData);
    
    if (!data.length) { 
      list.innerHTML = '<p class="fineprint">Nothing kept yet. Whatever you write down remains private to you.</p>'; 
      return; 
    }

    const rows = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const plain = await decryptText(encryptionKey, row.iv, row.ciphertext);
        rows.push({ index: i, date: row.created_at, text: plain });
      } catch (e) {
        rows.push({ index: i, date: row.created_at, text: '[could not decrypt: invalid key]' });
      }
    }

    // Sort newest first
    const sorted = rows.reverse();

    list.innerHTML = sorted.map(r => `
      <div class="entry-row" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding:16px 0; gap:12px;">
        <div style="flex:1;">
          <div class="entry-meta" style="font-size:0.8rem; color:var(--ink-faint);">${new Date(r.date).toLocaleString()}</div>
          <div style="font-size:1.02rem; color:var(--ink); margin-top:4px; white-space:pre-wrap;">${r.text}</div>
        </div>
        <button class="entry-delete btn btn-ghost" data-index="${r.index}" style="padding:6px; min-height:36px; min-width:36px; font-size:0.85rem;">Let this go</button>
      </div>
    `).join('');

    $$('.entry-delete', list).forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const entries = JSON.parse(localStorage.getItem('sukoon_keepsakes') || '[]');
        entries.splice(idx, 1);
        localStorage.setItem('sukoon_keepsakes', JSON.stringify(entries));
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
        const entries = JSON.parse(localStorage.getItem('sukoon_keepsakes') || '[]');
        entries.push({
          iv,
          ciphertext,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('sukoon_keepsakes', JSON.stringify(entries));
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

  /* ============ Dust Particles Animation ============ */
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
    const maxParticles = 15;

    for (let i = 0; i < maxParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1 + Math.random() * 1.5,
        vx: -0.05 + Math.random() * 0.1,
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

  function initFireplace() {
    const textarea = $('#fireplace-input');
    const burnBtn = $('#fireplace-burn');
    const stage = $('#fireplace-stage');
    if (!textarea || !burnBtn || !stage) return;

    burnBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) return;
      
      const chars = text.split('');
      stage.innerHTML = chars.map(ch => {
        const delay = (Math.random() * 1.2).toFixed(2);
        const dx = (Math.random() * 60 - 30).toFixed(0);
        const display = ch === ' ' ? '&nbsp;' : ch;
        return `<span class="ash-char" style="--d:${delay}s; --dx:${dx}">${display}</span>`;
      }).join('');
      
      stage.classList.add('is-burning');
      textarea.value = '';
      textarea.disabled = true;
      
      setTimeout(() => {
        stage.innerHTML = '';
        stage.classList.remove('is-burning');
        textarea.disabled = false;
      }, 2600);
    });
  }

  /* ============ Page Init ============ */
  document.addEventListener('DOMContentLoaded', async () => {
    initDustParticles();
    initAuthForm();
    initSignOut();
    initKeepsakeForm();
    initFireplace();

    const key = await loadSessionKey();
    if (key) {
      encryptionKey = key;
      showAtticApp();
    }
  });
})();
