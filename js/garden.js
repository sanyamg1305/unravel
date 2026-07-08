(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ============ Breath cue tones (rise on inhale, chime on hold, fall on exhale) ============ */
  let breathCtx = null;
  function ensureBreathCtx() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!breathCtx) breathCtx = new AudioCtx();
    if (breathCtx.state === 'suspended') breathCtx.resume().catch(() => {});
    return breathCtx;
  }

  function playBreathCue(phase) {
    if (localStorage.getItem('thermostat_mute_audio') === 'true') return;
    const ctx = ensureBreathCtx();
    if (!ctx || ctx.state !== 'running') return; // not yet unlocked by a user gesture

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.connect(gain);

    if (phase === 'in') {
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(330, now + 3.6);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
      osc.start(now);
      osc.stop(now + 4);
    } else if (phase === 'hold') {
      osc.frequency.setValueAtTime(330, now);
      gain.gain.exponentialRampToValueAtTime(0.025, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
      osc.start(now);
      osc.stop(now + 1.4);
    } else if (phase === 'out') {
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.exponentialRampToValueAtTime(196, now + 7.4);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 7.8);
      osc.start(now);
      osc.stop(now + 8);
    }
  }

  /* ============ 60-Second Reset (4-7-8 breathing) ============ */
  function initResetCircle() {
    const word = $('#reset-word');
    const pulse = $('.pulse');
    const toggleBtn = $('#reset-toggle');
    if (!word || !pulse || !toggleBtn) return;

    const cycle = [
      { label: 'Breathe in…', at: 0, phase: 'in' },
      { label: 'Hold…', at: 4000, phase: 'hold' },
      { label: 'Breathe out…', at: 11000, phase: 'out' },
    ];
    const totalMs = 19000;
    let startedAt = performance.now();
    let paused = false;
    let raf;
    let lastPhase = null;

    function tick(now) {
      if (!paused) {
        const elapsed = (now - startedAt) % totalMs;
        const step = cycle.slice().reverse().find(c => elapsed >= c.at);
        if (word.textContent !== step.label) word.textContent = step.label;
        if (lastPhase !== step.phase) {
          lastPhase = step.phase;
          playBreathCue(step.phase);
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    toggleBtn.addEventListener('click', () => {
      paused = !paused;
      pulse.style.animationPlayState = paused ? 'paused' : 'running';
      toggleBtn.textContent = paused ? 'Resume' : 'Pause';
      ensureBreathCtx();
    });
  }

  /* ============ Fireflies (decorative ambient animation) ============ */
  function initFireflies() {
    const field = $('#firefly-field');
    if (!field) return;
    const count = 7;
    for (let i = 0; i < count; i++) {
      const f = document.createElement('span');
      f.className = 'firefly';
      f.style.setProperty('--f-x', `${5 + Math.random() * 90}%`);
      f.style.setProperty('--f-dur', `${7 + Math.random() * 6}s`);
      f.style.setProperty('--f-delay', `${Math.random() * 8}s`);
      f.style.setProperty('--f-dx', `${-30 + Math.random() * 60}px`);
      field.appendChild(f);
    }
  }

  /* ============ Sound Window (synthesized ambient tones) ============ */
  let audioCtx = null;
  let activeNodes = [];

  function stopSound() {
    activeNodes.forEach(n => { try { n.stop(); } catch (e) {} });
    activeNodes = [];
    $$('[data-track]').forEach(b => { b.textContent = '▶'; });
  }

  function playSound(kind, btn) {
    stopSound();
    if (localStorage.getItem('thermostat_mute_audio') === 'true') {
      btn.textContent = '🔇 Muted';
      setTimeout(() => { btn.textContent = '▶'; }, 1500);
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) audioCtx = new AudioCtx();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.05;
    gain.connect(audioCtx.destination);

    if (kind === 'rain') {
      const bufferSize = 2 * audioCtx.sampleRate;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 550;
      noise.connect(filter).connect(gain);
      noise.start();
      activeNodes = [noise];
    } else if (kind === 'birdsong') {
      const chirp = () => {
        const osc = audioCtx.createOscillator();
        const chirpGain = audioCtx.createGain();
        osc.type = 'sine';
        const base = 1800 + Math.random() * 1200;
        osc.frequency.setValueAtTime(base, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(base * 1.4, audioCtx.currentTime + 0.08);
        chirpGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        chirpGain.gain.exponentialRampToValueAtTime(0.05, audioCtx.currentTime + 0.02);
        chirpGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
        osc.connect(chirpGain).connect(gain);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      };
      chirp();
      const interval = setInterval(chirp, 900 + Math.random() * 1400);
      activeNodes = [{ stop: () => clearInterval(interval) }];
    } else {
      const osc = audioCtx.createOscillator();
      const chimesGain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 528;
      chimesGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      osc.connect(chimesGain).connect(gain);
      osc.start();

      const interval = setInterval(() => {
        const note = [528, 659, 784, 880][Math.floor(Math.random() * 4)];
        chimesGain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        osc.frequency.setValueAtTime(note, audioCtx.currentTime);
        chimesGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
      }, 2000);

      activeNodes = [osc, { stop: () => clearInterval(interval) }];
    }
    btn.textContent = '⏸';
  }

  function initSoundWindow() {
    $$('[data-track]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.textContent.trim() === '⏸') stopSound();
        else playSound(btn.dataset.track, btn);
      });
    });
    document.addEventListener('sukoon-environment-change', () => {
      if (localStorage.getItem('thermostat_mute_audio') === 'true') stopSound();
    });
  }

  /* ============ Companion chat + weather rating ============ */
  function initCompanion() {
    const space = $('#companion-space');
    const openBtn = $('#companion-open');
    const log = $('#companion-chat-log');
    const input = $('#companion-input');
    const sendBtn = $('#companion-send');
    const finishBtn = $('#companion-finish');
    const typing = $('#companion-typing');
    const ratingWrap = $('#reflection-rating');
    if (!space || !log || !input || !sendBtn) return;

    let greeted = false;
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        space.classList.remove('hidden');
        openBtn.classList.add('hidden');
        space.scrollIntoView({ behavior: 'smooth' });
        if (!greeted) {
          greeted = true;
          appendMessage('companion', "I'm here while you ground yourself. Say as much or as little as you'd like.");
        }
      });
    }

    function appendMessage(sender, text) {
      const b = document.createElement('div');
      b.className = `chat-bubble ${sender}`;
      b.textContent = text;
      log.appendChild(b);
      log.scrollTop = log.scrollHeight;
    }

    async function handleSend() {
      const msg = input.value.trim();
      if (!msg) return;
      appendMessage('user', msg);
      input.value = '';
      sendBtn.disabled = true;
      if (typing) typing.classList.remove('hidden');

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'companion', payload: { emotion: 'Grounding', journalText: msg } }),
        });
        const data = await res.json();
        if (typing) typing.classList.add('hidden');
        appendMessage('companion', (data.ok && data.data && data.data.text)
          ? data.data.text
          : "Thank you for sharing that with me. I'm still here.");
      } catch (e) {
        if (typing) typing.classList.add('hidden');
        appendMessage('companion', "Thank you for sharing that with me. I'm still here.");
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSend(); });

    if (finishBtn && ratingWrap) {
      finishBtn.addEventListener('click', () => {
        space.classList.add('hidden');
        ratingWrap.classList.remove('hidden');
        ratingWrap.scrollIntoView({ behavior: 'smooth' });
      });
    }

    if (ratingWrap) {
      $$('.weather-rating-card', ratingWrap).forEach(card => {
        card.addEventListener('click', () => {
          const weather = card.dataset.weather;
          const list = JSON.parse(localStorage.getItem('sukoon_weather_history') || '[]');
          list.push({ date: new Date().toISOString(), room: 'Garden', weather });
          localStorage.setItem('sukoon_weather_history', JSON.stringify(list));
          let plantVisits = parseInt(localStorage.getItem('sukoon_plant_visits') || '0', 10);
          localStorage.setItem('sukoon_plant_visits', plantVisits + 1);

          ratingWrap.querySelector('.reflection-rating-overlay').innerHTML = `
            <h2 class="display-sm" style="font-size:1.2rem; margin-bottom:12px;">Thank you for grounding with me.</h2>
            <p class="lede lede-sm">However that felt, it counts. Come back whenever you need to.</p>
            <button class="btn btn-primary" id="rating-done-btn" style="margin-top:16px;">Finish</button>
          `;
          $('#rating-done-btn').addEventListener('click', () => location.reload());
        });
      });

      const closeBtn = $('#rating-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => location.reload());
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initResetCircle();
    initFireflies();
    initSoundWindow();
    initCompanion();
  });
})();
