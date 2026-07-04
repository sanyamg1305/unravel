(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);

  /* ============ 60-Second Reset (4-7-8 breathing) ============ */
  function initResetCircle() {
    const word = $('#reset-word');
    const pulse = document.querySelector('.pulse');
    const toggleBtn = $('#reset-toggle');
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
    document.querySelectorAll('[data-track]').forEach(b => { b.textContent = '▶'; });
  }

  function playSound(kind, btn) {
    stopSound();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) audioCtx = new AudioCtx();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.06;
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
      filter.frequency.value = 600;
      noise.connect(filter).connect(gain);
      noise.start();
      activeNodes = [noise];
    } else {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 396;
      osc.connect(gain);
      osc.start();
      activeNodes = [osc];
    }
    btn.textContent = '⏸';
  }

  function initSoundWindow() {
    document.querySelectorAll('[data-track]').forEach(btn => {
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

  document.addEventListener('DOMContentLoaded', () => {
    initResetCircle();
    initSoundWindow();
    initScreamJar();
  });
})();
