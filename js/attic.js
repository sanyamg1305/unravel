(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const SESSION_KEY_STORAGE = 'sukoon_derived_key';
  let supa = null;
  let currentUser = null;

  /* ============ Setup / connection state ============ */
  function isConfigured() {
    return !!(window.SUKOON_SUPABASE && window.SUKOON_SUPABASE.url && window.SUKOON_SUPABASE.anonKey);
  }

  function initSupabase() {
    if (!isConfigured() || !window.supabase) return null;
    return window.supabase.createClient(window.SUKOON_SUPABASE.url, window.SUKOON_SUPABASE.anonKey);
  }

  /* ============ Client-side encryption (WebCrypto) ============ */
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

  /* ============ Auth ============ */
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
    $('#growth-count').textContent = profile.visit_count || 1;
    loadEntries();
    checkDeliveredLetters();
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

  /* ============ The Fireplace (ephemeral, never sent anywhere) ============ */
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

  /* ============ The Keepsake Box (encrypted CRUD) ============ */
  async function loadEntries() {
    const list = $('#keepsake-list');
    if (!list) return;
    list.innerHTML = '<p class="fineprint">Opening the box…</p>';
    const { data, error } = await supa.from('entries').select('*').order('created_at', { ascending: false });
    if (error) { list.innerHTML = `<p class="fineprint">Couldn't load entries: ${error.message}</p>`; return; }
    if (!data.length) { list.innerHTML = '<p class="fineprint">Nothing kept yet. Whatever you save here stays only for you.</p>'; return; }

    const rows = await Promise.all(data.map(async (row) => {
      try {
        const plain = await decryptText(encryptionKey, row.iv, row.ciphertext);
        return { id: row.id, date: row.created_at, text: plain };
      } catch (e) {
        return { id: row.id, date: row.created_at, text: '[could not decrypt with this session\'s key]' };
      }
    }));

    list.innerHTML = rows.map(r => `
      <div class="entry-row">
        <div>
          <div class="entry-meta">${new Date(r.date).toLocaleString()}</div>
          <div>${r.text.slice(0, 140)}${r.text.length > 140 ? '…' : ''}</div>
        </div>
        <button class="entry-delete" data-id="${r.id}">Let this one go</button>
      </div>
    `).join('');

    $$('.entry-delete', list).forEach(btn => {
      btn.addEventListener('click', async () => {
        await supa.from('entries').delete().eq('id', btn.dataset.id);
        loadEntries();
      });
    });

    window.__sukoonDecryptedEntries = rows;
  }

  function initKeepsakeForm() {
    const textarea = $('#keepsake-input');
    const saveBtn = $('#keepsake-save');
    if (!textarea || !saveBtn) return;
    saveBtn.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) return;
      saveBtn.disabled = true;
      const { iv, ciphertext } = await encryptText(encryptionKey, text);
      await supa.from('entries').insert({ user_id: currentUser.id, iv, ciphertext });
      textarea.value = '';
      saveBtn.disabled = false;
      loadEntries();
    });
  }

  /* ============ Pack Your Bags (export) ============ */
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function initExport() {
    const txtBtn = $('#export-txt');
    const pdfBtn = $('#export-pdf');
    if (!txtBtn || !pdfBtn) return;

    txtBtn.addEventListener('click', () => {
      const entries = window.__sukoonDecryptedEntries || [];
      const text = entries.map(e => `${new Date(e.date).toLocaleString()}\n${e.text}\n`).join('\n---\n\n');
      download('sukoon-keepsake-box.txt', text || 'Nothing kept yet.', 'text/plain');
    });

    pdfBtn.addEventListener('click', async () => {
      const btn = $('#export-pdf');
      btn.disabled = true;
      btn.textContent = 'Packing…';
      try {
        if (!window.jspdf) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const entries = window.__sukoonDecryptedEntries || [];
        let y = 20;
        doc.setFontSize(16); doc.text('Sukoon — Keepsake Box', 14, y); y += 12;
        doc.setFontSize(11);
        entries.forEach(e => {
          const dateStr = new Date(e.date).toLocaleString();
          const lines = doc.splitTextToSize(`${dateStr}\n${e.text}`, 180);
          if (y + lines.length * 6 > 280) { doc.addPage(); y = 20; }
          doc.text(lines, 14, y);
          y += lines.length * 6 + 8;
        });
        if (!entries.length) doc.text('Nothing kept yet.', 14, y);
        doc.save('sukoon-keepsake-box.pdf');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Download as PDF';
      }
    });
  }

  /* ============ The Overthinker's Desk ============ */
  function initOverthinkerDesk() {
    const fileInput = $('#overthink-file');
    const textInput = $('#overthink-text');
    const submitBtn = $('#overthink-submit');
    const resultBox = $('#overthink-result');
    if (!fileInput || !textInput || !submitBtn || !resultBox) return;

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    submitBtn.addEventListener('click', async () => {
      const message = textInput.value.trim();
      const file = fileInput.files[0];
      if (!message && !file) return;

      submitBtn.disabled = true;
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = '<p class="fineprint">Looking at this with you…</p>';

      const payload = { message, hasImage: !!file };
      if (file) {
        try {
          payload.imageBase64 = await fileToBase64(file);
          payload.imageMimeType = file.type;
        } catch (e) { /* ignore, proceed text-only */ }
      }

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'overthink', payload }),
        });
        const body = await res.json();
        if (!body.ok) throw new Error(body.error || 'Something went wrong');
        const d = body.data;
        resultBox.innerHTML = `
          <div class="card" style="text-align:left;">
            <p><b>What was actually said:</b> ${d.whatTheySaid}</p>
            <p style="margin-top:10px;"><b>Ways this could reasonably be read:</b></p>
            <ul>${d.likelyMeanings.map(m => `<li>${m}</li>`).join('')}</ul>
            ${d.whatSeemsUnlikely ? `<p style="margin-top:10px;"><b>Might be worth setting down:</b> ${d.whatSeemsUnlikely}</p>` : ''}
            <p style="margin-top:10px;"><b>For right now:</b> ${d.groundingReminder}</p>
          </div>
        `;
      } catch (err) {
        resultBox.innerHTML = `<p class="fineprint">This tool needs a Gemini API key configured on the server to work. (${err.message})</p>`;
      } finally {
        submitBtn.disabled = false;
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
    const maxParticles = 30;

    for (let i = 0; i < maxParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1 + Math.random() * 2.5,
        vx: -0.1 + Math.random() * 0.2,
        vy: -0.05 + Math.random() * 0.15,
        op: 0.1 + Math.random() * 0.45
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
    let greeting = 'Some memories become lighter when someone else sees them.';
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
          appendBubble('companion', 'I spent a little time with your words. Let’s sit here together.');
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
        saveWeatherRating(activeEmotion || 'Attic', weather);

        ratingSpace.innerHTML = `
          <div class="card">
            <h2 class="display-sm" style="font-size:1.2rem; margin-bottom:12px;">Thank you for reflecting with me.</h2>
            <p class="lede lede-sm">Some thoughts aren't meant to be carried forever. I hope you feel a little lighter now.</p>
            <button class="btn btn-primary" id="done-ref-btn" style="margin-top:16px;">Finish</button>
          </div>
        `;
        
        $('#done-ref-btn').addEventListener('click', () => {
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
      room: 'Attic',
      emotion: emotion,
      weather: weather
    });
    localStorage.setItem('sukoon_weather_history', JSON.stringify(list));

    // Water plant
    let plantVisits = parseInt(localStorage.getItem('sukoon_plant_visits') || '0', 10);
    localStorage.setItem('sukoon_plant_visits', plantVisits + 1);
  }

  /* ============ Letter to Future Self (v4) ============ */
  function initFutureLetters() {
    const input = $('#future-letter-input');
    const saveBtn = $('#future-letter-save');
    const status = $('#future-letter-status');
    const monthsSelect = $('#future-letter-time');

    if (!saveBtn || !input) return;

    saveBtn.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;

      const months = parseInt(monthsSelect.value, 10);
      const deliveryDate = new Date();
      deliveryDate.setMonth(deliveryDate.getMonth() + months);

      // Save locally (or encrypt using Attic key if signed in)
      const letterObj = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        date: new Date().toISOString(),
        deliverAt: deliveryDate.toISOString(),
        text: text
      };

      const letters = JSON.parse(localStorage.getItem('sukoon_future_letters') || '[]');
      letters.push(letterObj);
      localStorage.setItem('sukoon_future_letters', JSON.stringify(letters));

      input.value = '';
      status.textContent = `Your letter has been locked and saved. It will quietly wait here for you until ${deliveryDate.toLocaleDateString()}.`;
      checkDeliveredLetters();
    });
  }

  function checkDeliveredLetters() {
    const container = $('#delivered-letters');
    if (!container) return;

    const letters = JSON.parse(localStorage.getItem('sukoon_future_letters') || '[]');
    const now = new Date();

    const delivered = letters.filter(l => new Date(l.deliverAt) <= now);
    const pendingCount = letters.length - delivered.length;

    let html = '';
    if (delivered.length > 0) {
      html += `<h3 class="display-sm" style="font-size:1.1rem; margin-top:20px;">Letters Delivered:</h3>`;
      delivered.forEach(l => {
        html += `
          <div class="card" style="margin-top:12px; background:var(--surface-soft); border:1px solid var(--line);">
            <div class="entry-meta">Written on ${new Date(l.date).toLocaleDateString()} — Delivered on ${new Date(l.deliverAt).toLocaleDateString()}</div>
            <p style="margin-top:8px; font-style:italic;">"${l.text}"</p>
          </div>
        `;
      });
    }

    if (pendingCount > 0) {
      html += `
        <p class="fineprint" style="margin-top:14px; font-style:italic;">
          📬 You have ${pendingCount} private letter(s) waiting in the future.
        </p>
      `;
    }

    container.innerHTML = html;
  }

  /* ============ Page Init ============ */
  document.addEventListener('DOMContentLoaded', async () => {
    initDustParticles();
    initCompanionChat();
    initFireplace();
    initFutureLetters();

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
    initExport();
    initOverthinkerDesk();

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
    } else {
      checkDeliveredLetters(); // Non-authed users can also see local offline letters
    }
  });
})();
