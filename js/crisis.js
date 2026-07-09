(() => {
  'use strict';
  // Timezone-based region guess: zero permissions, zero network calls, so this
  // works instantly and even offline. Deliberately not using a geocoding API,
  // since this page's first job is to be fast and available on poor connections.

  const REGIONS = {
    US: {
      note: 'Showing US resources, based on your device\'s timezone.',
      numbers: [
        { label: 'Call or text 988', sub: 'Suicide & Crisis Lifeline', href: 'tel:988' },
        { label: 'Text HOME to 741741', sub: 'Crisis Text Line', href: 'sms:741741&body=HOME' },
        { label: 'Call 911', sub: 'Immediate danger', href: 'tel:911' },
      ],
    },
    CA: {
      note: 'Showing Canadian resources, based on your device\'s timezone.',
      numbers: [
        { label: 'Call or text 988', sub: 'Suicide Crisis Helpline (Canada)', href: 'tel:988' },
        { label: 'Text HOME to 741741', sub: 'Crisis Text Line', href: 'sms:741741&body=HOME' },
        { label: 'Call 911', sub: 'Immediate danger', href: 'tel:911' },
      ],
    },
    GB: {
      note: 'Showing UK & Ireland resources, based on your device\'s timezone.',
      numbers: [
        { label: 'Call 116 123', sub: 'Samaritans (UK & ROI)', href: 'tel:116123' },
        { label: 'Text SHOUT to 85258', sub: 'Shout Crisis Text Line', href: 'sms:85258&body=SHOUT' },
        { label: 'Call 999', sub: 'Immediate danger', href: 'tel:999' },
      ],
    },
    IN: {
      note: 'Showing India resources, based on your device\'s timezone.',
      numbers: [
        { label: 'Call 14416', sub: 'Tele-MANAS (India)', href: 'tel:14416' },
        { label: 'Call 9152987821', sub: 'iCall Helpline', href: 'tel:+919152987821' },
        { label: 'Call 99996 66555', sub: 'Vandrevala Foundation Helpline', href: 'tel:+919999666555' },
        { label: 'Call 112', sub: 'Immediate danger', href: 'tel:112' },
      ],
    },
    AU: {
      note: 'Showing Australia resources, based on your device\'s timezone.',
      numbers: [
        { label: 'Call 13 11 14', sub: 'Lifeline Australia', href: 'tel:131114' },
        { label: 'Text 0477 13 11 14', sub: 'Lifeline Text', href: 'sms:0477131114' },
        { label: 'Call 000', sub: 'Immediate danger', href: 'tel:000' },
      ],
    },
  };

  function guessRegion() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise)/.test(tz)) return 'US';
    if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Montreal)/.test(tz)) return 'CA';
    if (/^Europe\/(London|Belfast|Dublin)/.test(tz)) return 'GB';
    if (/^Asia\/(Kolkata|Calcutta)/.test(tz)) return 'IN';
    if (/^Australia\//.test(tz)) return 'AU';
    return null;
  }

  function render() {
    const region = guessRegion();
    if (!region || !REGIONS[region]) return; // keep the static default markup
    const data = REGIONS[region];
    const grid = document.getElementById('tel-grid');
    const note = document.getElementById('region-note');
    if (note) note.textContent = data.note;
    if (grid) {
      grid.innerHTML = data.numbers.map(n => `
        <a class="tel-link" href="${n.href}"><span>${n.label}</span><small>${n.sub}</small></a>
      `).join('');
    }
  }

  // Breathing pacer tone, synced to the .pacer-static CSS animation (12s:
  // 6s expanding/inhale, 6s contracting/exhale). Kept self-contained (no
  // global.js) since this page is deliberately dependency-free for speed.
  let pacerAudioCtx = null;
  function ensurePacerAudioCtx() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!pacerAudioCtx) pacerAudioCtx = new AudioCtx();
    if (pacerAudioCtx.state === 'suspended') pacerAudioCtx.resume().catch(() => {});
    return pacerAudioCtx;
  }

  function playPacerTone(rising) {
    if (localStorage.getItem('thermostat_mute_audio') === 'true') return;
    const ctx = ensurePacerAudioCtx();
    if (!ctx || ctx.state !== 'running') return; // not yet unlocked by a user gesture

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.connect(gain);

    if (rising) {
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(330, now + 5.4);
    } else {
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.exponentialRampToValueAtTime(196, now + 5.4);
    }
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.8);
    osc.start(now);
    osc.stop(now + 6);
  }

  function initBreathPacer() {
    if (!document.querySelector('.pacer-static')) return;
    const word = document.getElementById('pacer-word');

    let unlocked = false;
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      ensurePacerAudioCtx();
    }
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    const CYCLE_MS = 12000;
    const HALF_MS = 6000;
    let lastHalf = null;
    function tick(now) {
      const elapsed = now % CYCLE_MS;
      const half = elapsed < HALF_MS ? 'in' : 'out';
      if (half !== lastHalf) {
        lastHalf = half;
        playPacerTone(half === 'in');
        if (word) word.textContent = half === 'in' ? 'Breathe in…' : 'Breathe out…';
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    initBreathPacer();
  });
})();
