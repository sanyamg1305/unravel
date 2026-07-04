(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ============ Sun / Moon (night mode) ============ */
  const THEME_KEY = 'sukoon_theme_override';

  function isNightHours() {
    const h = new Date().getHours();
    return h >= 22 || h < 5;
  }

  function applyTheme() {
    const override = localStorage.getItem(THEME_KEY);
    const theme = override || (isNightHours() ? 'night' : 'day');
    document.documentElement.setAttribute('data-theme', theme);
    $$('.sun-moon-toggle').forEach(btn => {
      btn.setAttribute('aria-pressed', theme === 'night' ? 'true' : 'false');
      btn.textContent = theme === 'night' ? '🌙' : '☀️';
    });
    return theme;
  }

  function initSunMoon() {
    $$('.sun-moon-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'night' ? 'day' : 'night';
        localStorage.setItem(THEME_KEY, next);
        applyTheme();
      });
    });
    applyTheme();
  }

  /* ============ Sensory Thermostat ============ */
  const SENSORY_KEY = 'sukoon_sensory_mode';

  function applySensory() {
    const mode = localStorage.getItem(SENSORY_KEY) || 'normal';
    if (mode === 'low') document.documentElement.setAttribute('data-sensory', 'low');
    else document.documentElement.removeAttribute('data-sensory');
    $$('.sensory-toggle').forEach(btn => btn.setAttribute('aria-pressed', mode === 'low' ? 'true' : 'false'));
    return mode;
  }

  function initSensory() {
    $$('.sensory-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const current = localStorage.getItem(SENSORY_KEY) || 'normal';
        localStorage.setItem(SENSORY_KEY, current === 'low' ? 'normal' : 'low');
        applySensory();
      });
    });
    applySensory();
  }

  /* ============ Slip Out the Back (Quick Exit) ============ */
  function initQuickExit() {
    $$('.quick-exit').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          history.pushState(null, '', 'https://www.google.com');
          for (let i = 0; i < 8; i++) history.pushState(null, '', 'https://www.google.com');
        } catch (e) { /* ignore */ }
        window.location.replace('https://www.google.com');
      });
    });
    // panic key: pressing Escape three times quickly also exits
    let escCount = 0;
    let escTimer = null;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      escCount += 1;
      clearTimeout(escTimer);
      escTimer = setTimeout(() => { escCount = 0; }, 900);
      if (escCount >= 3) window.location.replace('https://www.google.com');
    });
  }

  /* ============ Welcome Mat (first-visit onboarding) ============ */
  const WELCOME_KEY = 'sukoon_welcome_seen';

  function buildWelcomeMat() {
    if (localStorage.getItem(WELCOME_KEY)) return;
    if ($('#welcome-mat-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'welcome-mat-overlay';
    overlay.id = 'welcome-mat-overlay';
    overlay.innerHTML = `
      <div class="welcome-mat-card" role="dialog" aria-modal="true" aria-labelledby="welcome-mat-heading">
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
    $('#welcome-mat-tour').addEventListener('click', () => {
      showGentleGuide(overlay);
    });
  }

  const TOUR_STEPS = [
    { title: 'The Foyer', body: 'This is where you start. Pick whatever tag feels closest to how you feel right now, no wrong answers.' },
    { title: 'The Garden & The Attic', body: 'The Garden has quick grounding tools. The Attic is your private, saved space for journaling when you\'re ready.' },
    { title: 'Always within reach', body: 'The porch light in the corner always leads to real crisis support. The quick-exit link always leads you away, instantly.' },
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

  /* ============ Init ============ */
  document.addEventListener('DOMContentLoaded', () => {
    initSunMoon();
    initSensory();
    initQuickExit();
    buildWelcomeMat();
  });

  window.Sukoon = window.Sukoon || {};
  window.Sukoon.applyTheme = applyTheme;
  window.Sukoon.isNightHours = isNightHours;
})();
