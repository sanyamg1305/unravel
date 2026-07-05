(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ============ 60-Second Reset (4-7-8 breathing) ============ */
  function initResetCircle() {
    const word = $('#reset-word');
    const pulse = document.querySelector('.pulse');
    const toggleBtn = $('#reset-toggle');
    if (!word || !pulse || !toggleBtn) return;
    
    const cycle = [
      { label: 'Breathe in…', at: 0 },
      { label: 'Hold…', at: 4000 },
      { label: 'Breathe out…', at: 11000 },
    ];
    const totalMs = 19000;
    let startedAt = performance.now();
    let paused = false;
    let raf;

    function tick(now) {
      if (!paused) {
        const elapsed = (now - startedAt) % totalMs;
        const step = cycle.slice().reverse().find(c => elapsed >= c.at);
        if (word.textContent !== step.label) word.textContent = step.label;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    toggleBtn.addEventListener('click', () => {
      paused = !paused;
      pulse.style.animationPlayState = paused ? 'paused' : 'running';
      toggleBtn.textContent = paused ? 'Resume' : 'Pause';
    });
  }

  /* ============ Sound Window (synthesized ambient tones) ============ */
  let activeNodes = [];
  let audioCtx = null;

  function stopSound() {
    activeNodes.forEach(n => { try { n.stop(); } catch (e) {} });
    activeNodes = [];
    $$('[data-track]').forEach(b => { b.textContent = '▶'; });
  }

  function playSound(kind, btn) {
    stopSound();
    
    // Check if muted in sensory settings
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
    } else {
      // Bell tone (slow decay sine)
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 396; // Solfeggio frequency for grounding
      const bellGain = audioCtx.createGain();
      bellGain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 3);
      osc.connect(bellGain).connect(audioCtx.destination);
      osc.start();
      activeNodes = [osc];
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
  }

  /* ============ The Scream Jar (mic visualizer, nothing recorded) ============ */
  function initScreamJar() {
    const startBtn = $('#jar-start');
    const canvas = $('#jar-canvas');
    const status = $('#jar-status');
    if (!startBtn || !canvas) return;
    const ctx2d = canvas.getContext('2d');

    startBtn.addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        canvas.classList.remove('hidden');
        status.classList.remove('hidden');
        startBtn.classList.add('hidden');

        function draw() {
          requestAnimationFrame(draw);
          analyser.getByteTimeDomainData(data);
          ctx2d.clearRect(0, 0, canvas.width, canvas.height);
          ctx2d.lineWidth = 3;
          ctx2d.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--rust') || '#a34a45';
          ctx2d.beginPath();
          const sliceWidth = canvas.width / data.length;
          let x = 0;
          for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0;
            const y = (v * canvas.height) / 2;
            if (i === 0) ctx2d.moveTo(x, y);
            else ctx2d.lineTo(x, y);
            x += sliceWidth;
          }
          ctx2d.lineTo(canvas.width, canvas.height / 2);
          ctx2d.stroke();
        }
        draw();
      } catch (e) {
        status.textContent = "Microphone access wasn't available. That's alright, this tool is optional.";
        status.classList.remove('hidden');
      }
    });
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
    let greeting = 'Let’s untangle one thing at a time.';
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
          appendBubble('companion', 'I spent a little time with your words. Let’s stay here for a moment.');
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
        saveWeatherRating(activeEmotion || 'Garden', weather);

        ratingSpace.innerHTML = `
          <div class="card">
            <h2 class="display-sm" style="font-size:1.2rem; margin-bottom:12px;">Thank you for reflecting with me.</h2>
            <p class="lede lede-sm">Some thoughts aren't meant to be carried forever. I hope you feel a little lighter now.</p>
            <button class="btn btn-primary" id="done-ref-btn" style="margin-top:16px;">Finish</button>
          </div>
        `;
        
        $('#done-ref-btn').addEventListener('click', () => {
          // Clear query params and refresh
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
      room: 'Garden',
      emotion: emotion,
      weather: weather
    });
    localStorage.setItem('sukoon_weather_history', JSON.stringify(list));

    // Water plant
    let plantVisits = parseInt(localStorage.getItem('sukoon_plant_visits') || '0', 10);
    localStorage.setItem('sukoon_plant_visits', plantVisits + 1);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initResetCircle();
    initSoundWindow();
    initScreamJar();
    initCompanionChat();
  });
})();
