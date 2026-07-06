(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  window.Sukoon = window.Sukoon || {};

  /* ============ Sensory Thermostat Core Settings ============ */
  const THERMOSTAT_SETTINGS = [
    { key: 'thermostat_no_animations', class: 'no-animations' },
    { key: 'thermostat_mute_audio', class: 'mute-audio' },
    { key: 'thermostat_reduce_transparency', class: 'reduce-transparency' },
    { key: 'thermostat_large_text', class: 'large-text' },
    { key: 'thermostat_freeze_bg', class: 'freeze-bg' }
  ];

  function applyThermostatClasses() {
    THERMOSTAT_SETTINGS.forEach(setting => {
      const active = localStorage.getItem(setting.key) === 'true';
      document.documentElement.classList.toggle(setting.class, active);
    });
  }

  /* ============ Seasons & Time of Day Logic ============ */
  function getAutoSeason() {
    // 0 = Jan, 1 = Feb, etc.
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'monsoon';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  function getAutoTimeOfDay() {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) return 'morning';
    if (hours >= 12 && hours < 17) return 'afternoon';
    if (hours >= 17 && hours < 21) return 'evening';
    if (hours >= 21 || hours < 1) return 'night';
    return 'nightstand'; // 1 AM to 5 AM
  }

  function applyLivingWorld() {
    const currentSeasonOverride = localStorage.getItem('sukoon_season_override') || 'auto';
    const currentTimeOverride = localStorage.getItem('sukoon_time_override') || 'auto';

    const season = currentSeasonOverride === 'auto' ? getAutoSeason() : currentSeasonOverride;
    const timeOfDay = currentTimeOverride === 'auto' ? getAutoTimeOfDay() : currentTimeOverride;

    document.documentElement.setAttribute('data-season', season);
    document.documentElement.setAttribute('data-time', timeOfDay);

    // Sync old day/night theme attribute for backwards compatibility
    const isNight = timeOfDay === 'night' || timeOfDay === 'nightstand';
    document.documentElement.setAttribute('data-theme', isNight ? 'night' : 'day');

    renderSeasonOverlay(season);
  }

  /* ============ Season Weather Overlays ============ */
  function renderSeasonOverlay(season) {
    const old = $('.season-overlay');
    if (old) old.remove();

    if (localStorage.getItem('thermostat_no_animations') === 'true') return;
    if (localStorage.getItem('thermostat_freeze_bg') === 'true') return;

    const overlay = document.createElement('div');
    overlay.className = 'season-overlay';

    let particleCount = 0;
    let char = '';
    let color = '';

    if (season === 'winter') {
      particleCount = 20;
      char = '❄';
      color = 'rgba(255, 255, 255, 0.75)';
    } else if (season === 'autumn') {
      particleCount = 12;
      char = '🍂';
    } else if (season === 'spring') {
      particleCount = 12;
      char = '🌸';
    }

    if (particleCount === 0) return;

    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement('div');
      p.className = 'weather-particle';
      p.textContent = char;
      p.style.left = Math.random() * 100 + 'vw';
      p.style.top = -30 - Math.random() * 50 + 'px';
      p.style.fontSize = 10 + Math.random() * 14 + 'px';
      p.style.setProperty('--p-dur', 6 + Math.random() * 10 + 's');
      p.style.setProperty('--p-dx', -40 + Math.random() * 80 + 'px');
      p.style.setProperty('--p-op', 0.25 + Math.random() * 0.5);
      p.style.setProperty('--p-rot', Math.random() * 360 + 'deg');
      if (color) p.style.color = color;
      overlay.appendChild(p);
    }
    document.body.appendChild(overlay);
  }

  /* ============ Dynamically Injected Thermostat Panel ============ */
  function injectThermostat() {
    if ($('#thermostat-toggle')) return;

    // Inject drawer toggle button into the footer navigation if present, otherwise body
    const footerNav = $('footer.site-footer nav');
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'thermostat-toggle-btn';
    toggleBtn.id = 'thermostat-toggle';
    toggleBtn.innerHTML = '🌿 Sensory Thermostat';

    if (footerNav) {
      footerNav.appendChild(toggleBtn);
    } else {
      const floating = document.createElement('div');
      floating.className = 'floating-controls fc-bottom-left';
      floating.style.bottom = '80px';
      floating.appendChild(toggleBtn);
      document.body.appendChild(floating);
    }

    // Modal template
    const modal = document.createElement('div');
    modal.className = 'thermostat-overlay hidden';
    modal.id = 'thermostat-modal';
    modal.innerHTML = `
      <div class="thermostat-drawer" role="dialog" aria-modal="true" aria-labelledby="thermo-title">
        <h2 class="display-sm" id="thermo-title" style="font-size:1.4rem; margin-bottom:6px;">Sensory Thermostat</h2>
        <p class="lede lede-sm" style="margin-bottom:16px;">Adjust Sukoon's environment to your comfort.</p>
        
        <div class="thermostat-grid">
          <div class="thermostat-group">
            <label for="thermostat-season">Season</label>
            <select class="thermostat-select" id="thermostat-season">
              <option value="auto">Auto (Default)</option>
              <option value="spring">Spring 🌸</option>
              <option value="monsoon">Monsoon 🌧️</option>
              <option value="autumn">Autumn 🍂</option>
              <option value="winter">Winter ❄️</option>
            </select>
          </div>
          <div class="thermostat-group">
            <label for="thermostat-time">Time of Day</label>
            <select class="thermostat-select" id="thermostat-time">
              <option value="auto">Auto (Default)</option>
              <option value="morning">Morning ☀️</option>
              <option value="afternoon">Afternoon 🌤️</option>
              <option value="evening">Evening 🌅</option>
              <option value="night">Night 🌌</option>
              <option value="nightstand">Nightstand 🌙</option>
            </select>
          </div>
          
          <div class="thermostat-checkbox-list">
            <label class="thermostat-checkbox-item">
              <input type="checkbox" id="thermostat-no-anim">
              <span>Turn off animations</span>
            </label>
            <label class="thermostat-checkbox-item">
              <input type="checkbox" id="thermostat-mute">
              <span>Disable ambient sounds</span>
            </label>
            <label class="thermostat-checkbox-item">
              <input type="checkbox" id="thermostat-no-trans">
              <span>Reduce transparency</span>
            </label>
            <label class="thermostat-checkbox-item">
              <input type="checkbox" id="thermostat-large-txt">
              <span>Increase text size</span>
            </label>
            <label class="thermostat-checkbox-item">
              <input type="checkbox" id="thermostat-freeze-bg">
              <span>Freeze moving backgrounds</span>
            </label>
          </div>
        </div>
        
        <div style="display:flex; justify-content:flex-end; margin-top:20px;">
          <button class="btn btn-primary" id="thermostat-close">Save &amp; Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Event bindings
    toggleBtn.addEventListener('click', () => {
      // Load current settings into inputs
      $('#thermostat-season').value = localStorage.getItem('sukoon_season_override') || 'auto';
      $('#thermostat-time').value = localStorage.getItem('sukoon_time_override') || 'auto';
      
      $('#thermostat-no-anim').checked = localStorage.getItem('thermostat_no_animations') === 'true';
      $('#thermostat-mute').checked = localStorage.getItem('thermostat_mute_audio') === 'true';
      $('#thermostat-no-trans').checked = localStorage.getItem('thermostat_reduce_transparency') === 'true';
      $('#thermostat-large-txt').checked = localStorage.getItem('thermostat_large_text') === 'true';
      $('#thermostat-freeze-bg').checked = localStorage.getItem('thermostat_freeze_bg') === 'true';

      modal.classList.remove('hidden');
    });

    $('#thermostat-close').addEventListener('click', () => {
      // Save settings
      localStorage.setItem('sukoon_season_override', $('#thermostat-season').value);
      localStorage.setItem('sukoon_time_override', $('#thermostat-time').value);

      localStorage.setItem('thermostat_no_animations', $('#thermostat-no-anim').checked);
      localStorage.setItem('thermostat_mute_audio', $('#thermostat-mute').checked);
      localStorage.setItem('thermostat_reduce_transparency', $('#thermostat-no-trans').checked);
      localStorage.setItem('thermostat_large_text', $('#thermostat-large-txt').checked);
      localStorage.setItem('thermostat_freeze_bg', $('#thermostat-freeze-bg').checked);

      applyThermostatClasses();
      applyLivingWorld();
      modal.classList.add('hidden');
      
      // Notify other loaded room scripts that environment changed
      document.dispatchEvent(new CustomEvent('sukoon-environment-change'));
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  /* ============ Slip Out the Back & Quick Exit ============ */
  function initQuickExit() {
    $$('.quick-exit').forEach(btn => {
      btn.addEventListener('click', () => {
        window.Sukoon.clearDraft();
        try {
          history.pushState(null, '', 'https://www.google.com');
          for (let i = 0; i < 8; i++) history.pushState(null, '', 'https://www.google.com');
        } catch (e) { /* ignore */ }
        window.location.replace('https://www.google.com');
      });
    });
    // Escape x3 quick exit
    let escCount = 0;
    let escTimer = null;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      escCount += 1;
      clearTimeout(escTimer);
      escTimer = setTimeout(() => { escCount = 0; }, 900);
      if (escCount >= 3) {
        window.Sukoon.clearDraft();
        window.location.replace('https://www.google.com');
      }
    });
  }

  /* ============ Onboarding promises ============ */
  const WELCOME_KEY = 'sukoon_welcome_seen';
  function buildWelcomeMat() {
    if (localStorage.getItem(WELCOME_KEY)) return;
    if ($('#welcome-mat-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'welcome-mat-overlay';
    overlay.id = 'welcome-mat-overlay';
    overlay.innerHTML = `
      <div class="welcome-mat-card" role="dialog" aria-modal="true" aria-labelledby="welcome-mat-heading">
        <img src="assets/logo.jpeg" alt="Sukoon: a safe place to find your peace" class="welcome-mat-logo">
        <p class="eyebrow">before you come in</p>
        <h2 class="display-sm" id="welcome-mat-heading">Welcome to the Welcome Mat.</h2>
        <p class="lede lede-sm">Three simple promises, instead of a wall of legal text.</p>
        <ul class="promise-list">
          <li><span class="promise-icon">🤝</span><span>We promise to keep this space safe, private, and free of judgment.</span></li>
          <li><span class="promise-icon">💛</span><span>You promise to be kind to yourself while you're here, even if just a little.</span></li>
          <li><span class="promise-icon">🏡</span><span>You agree that Sukoon is a sanctuary, not a hospital. It's a caring companion, not a licensed therapist, and not a substitute for professional or emergency care.</span></li>
        </ul>
        <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
          <button class="btn btn-primary btn-lg" id="welcome-mat-accept">I agree, let me in</button>
          <button class="link-btn" id="welcome-mat-tour">Show me around first</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    $('#welcome-mat-accept').addEventListener('click', () => {
      localStorage.setItem(WELCOME_KEY, '1');
      overlay.remove();
    });
    $('#welcome-mat-tour').addEventListener('click', () => showGentleGuide(overlay));
  }

  const TOUR_STEPS = [
    { title: 'The Foyer', body: 'This is where you start. Choose the emotion that matches your head today, and we\'ll find a room for you.' },
    { title: 'The Rooms', body: 'Each room has a different feeling. You can sit quietly in silence, do a breathing exercise, or talk to our gentle companion.' },
    { title: 'Always within reach', body: 'The porch light in the corner leads to professional support. The exit button slips you out instantly if you need to go.' }
  ];

  function showGentleGuide(overlay) {
    let step = 0;
    const card = overlay.querySelector('.welcome-mat-card');
    function render() {
      const s = TOUR_STEPS[step];
      card.innerHTML = `
        <p class="eyebrow">a slow tour, step ${step + 1} of ${TOUR_STEPS.length}</p>
        <h2 class="display-sm">${s.title}</h2>
        <p class="lede lede-sm">${s.body}</p>
        <div class="tour-dots">${TOUR_STEPS.map((_, i) => `<span class="tour-dot ${i === step ? 'active' : ''}"></span>`).join('')}</div>
        <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
          <button class="btn btn-primary btn-lg" id="tour-next">${step === TOUR_STEPS.length - 1 ? 'Okay, I\'m ready' : 'Continue'}</button>
        </div>
      `;
      $('#tour-next', card).addEventListener('click', () => {
        if (step < TOUR_STEPS.length - 1) { step += 1; render(); }
        else { localStorage.setItem(WELCOME_KEY, '1'); overlay.remove(); }
      });
    }
    render();
  }

  /* ============ Accidental Exit Draft Restoration ============ */
  const DRAFT_KEY = 'sukoon_draft_backup';

  window.Sukoon.saveDraft = function(content) {
    if (content && content.trim()) {
      localStorage.setItem(DRAFT_KEY, content.trim());
    } else {
      window.Sukoon.clearDraft();
    }
  };

  window.Sukoon.clearDraft = function() {
    localStorage.removeItem(DRAFT_KEY);
  };

  function checkAndRestoreDraft() {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (!draft) return;

    const overlay = document.createElement('div');
    overlay.className = 'welcome-mat-overlay';
    overlay.id = 'draft-restore-overlay';
    overlay.style.zIndex = '101';
    overlay.innerHTML = `
      <div class="welcome-mat-card">
        <p class="eyebrow">draft recovered</p>
        <h2 class="display-sm">It looks like you left in the middle of writing.</h2>
        <p class="lede lede-sm">Would you like to restore what you were typing, or start fresh?</p>
        <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
          <button class="btn btn-primary" id="draft-restore-yes">Restore draft</button>
          <button class="btn btn-secondary" id="draft-restore-no">Burn it &amp; start fresh</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    $('#draft-restore-yes').addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('sukoon-restore-draft', { detail: draft }));
      overlay.remove();
    });

    $('#draft-restore-no').addEventListener('click', () => {
      window.Sukoon.clearDraft();
      overlay.remove();
    });
  }

  /* ============ Speech to text ============ */
  // Any <input> or <textarea> marked data-mic gets a small microphone button
  // inserted right after it, powered by the Web Speech API. Nothing is ever
  // recorded or sent anywhere; the browser does the transcription locally.
  function initSpeechToText() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    $$('[data-mic]').forEach(field => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mic-btn';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Speak instead of typing');
      btn.textContent = '🎤';
      field.insertAdjacentElement('afterend', btn);

      if (!SpeechRecognition) {
        btn.disabled = true;
        btn.title = 'Voice input is not supported in this browser';
        btn.style.opacity = '0.4';
        return;
      }

      let recognizing = false;
      let recognition = null;

      btn.addEventListener('click', () => {
        if (recognizing) { recognition.stop(); return; }

        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;
        let finalTranscript = field.value ? field.value.replace(/\s+$/, '') + ' ' : '';

        recognition.onstart = () => {
          recognizing = true;
          btn.classList.add('is-listening');
          btn.textContent = '⏹';
          btn.setAttribute('aria-pressed', 'true');
          btn.setAttribute('aria-label', 'Stop voice input');
        };
        recognition.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const transcript = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalTranscript += transcript + ' ';
            else interim += transcript;
          }
          field.value = finalTranscript + interim;
          field.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const stop = () => {
          recognizing = false;
          btn.classList.remove('is-listening');
          btn.textContent = '🎤';
          btn.setAttribute('aria-pressed', 'false');
          btn.setAttribute('aria-label', 'Speak instead of typing');
        };
        recognition.onerror = stop;
        recognition.onend = stop;
        recognition.start();
      });
    });
  }

  /* ============ Page Init ============ */
  document.addEventListener('DOMContentLoaded', () => {
    applyThermostatClasses();
    applyLivingWorld();
    injectThermostat();
    initQuickExit();
    buildWelcomeMat();
    checkAndRestoreDraft();
    initSpeechToText();
  });

  window.Sukoon.isNightHours = function() {
    const h = new Date().getHours();
    return h >= 22 || h < 5;
  };
})();
