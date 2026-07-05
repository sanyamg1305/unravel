(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const NIGHTSTAND_OVERRIDE_KEY = 'sukoon_nightstand_override';

  function decideView() {
    const foyer = $('#foyer-view');
    const nightstand = $('#nightstand-view');
    if (!foyer || !nightstand) return;

    const override = sessionStorage.getItem(NIGHTSTAND_OVERRIDE_KEY);
    const systemTimeOfDay = document.documentElement.getAttribute('data-time');

    let showNightstand = false;
    if (override === 'foyer') showNightstand = false;
    else if (override === 'nightstand') showNightstand = true;
    else showNightstand = systemTimeOfDay === 'nightstand';

    foyer.classList.toggle('hidden', showNightstand);
    nightstand.classList.toggle('hidden', !showNightstand);

    if (showNightstand) {
      initNightstandChat();
    }
  }

  function initToggles() {
    const toNS = $('#goto-nightstand');
    const toFoyer = $('#goto-foyer');

    if (toNS) {
      toNS.addEventListener('click', () => {
        sessionStorage.setItem(NIGHTSTAND_OVERRIDE_KEY, 'nightstand');
        decideView();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
    if (toFoyer) {
      toFoyer.addEventListener('click', () => {
        sessionStorage.setItem(NIGHTSTAND_OVERRIDE_KEY, 'foyer');
        decideView();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Listen to custom event from global.js thermostat updates
    document.addEventListener('sukoon-environment-change', decideView);
  }

  /* ============ Audio controls (respects Thermostat Mute) ============ */
  let activeOscillators = [];
  function stopAllTones() {
    activeOscillators.forEach(o => { try { o.stop(); } catch (e) {} });
    activeOscillators = [];
  }

  function playTone(kind, btn) {
    stopAllTones();
    $$('[data-track]').forEach(b => { b.textContent = '▶'; });

    // Check if muted in sensory settings
    if (localStorage.getItem('thermostat_mute_audio') === 'true') {
      btn.textContent = '🔇 Muted';
      setTimeout(() => { btn.textContent = '▶'; }, 1500);
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    gain.connect(ctx.destination);

    if (kind === 'rain') {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 450;
      noise.connect(filter).connect(gain);
      noise.start();
      activeOscillators = [noise];
    } else {
      // Wind chimes synth (gentle high-frequency pure bells)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 528;
      const chimesGain = ctx.createGain();
      chimesGain.gain.setValueAtTime(0.04, ctx.currentTime);
      osc.connect(chimesGain).connect(ctx.destination);
      osc.start();
      
      // Simple decay/flicker animation for chime
      let play = true;
      const interval = setInterval(() => {
        if (!play) return;
        const note = [528, 659, 784, 880][Math.floor(Math.random() * 4)];
        osc.frequency.setValueAtTime(note, ctx.currentTime);
        chimesGain.gain.setValueAtTime(0.03, ctx.currentTime);
        chimesGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      }, 2000);

      osc.onended = () => {
        clearInterval(interval);
        play = false;
      };

      activeOscillators = [osc];
    }
    btn.textContent = '⏸';
  }

  function initSoundStubs() {
    $$('[data-track]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.textContent.trim() === '⏸') {
          stopAllTones();
          btn.textContent = '▶';
        } else {
          playTone(btn.dataset.track, btn);
        }
      });
    });
  }

  /* ============ Nightstand Companion Chat & Rating ============ */
  let chatInitialized = false;
  function initNightstandChat() {
    if (chatInitialized) return;
    chatInitialized = true;

    const log = $('#nightstand-chat-log');
    const input = $('#nightstand-chat-input');
    const sendBtn = $('#nightstand-chat-send');
    const finishBtn = $('#nightstand-chat-finish');
    const chatPanel = $('#nightstand-chat');
    const ratingPanel = $('#nightstand-rating');
    const typing = $('#nightstand-typing');

    if (!log || !input || !sendBtn) return;

    // Greet user
    appendMessage('companion', 'The world is asleep. You don’t have to carry this until morning.');

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
      typing.classList.remove('hidden');

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'companion',
            payload: {
              emotion: 'Nightstand',
              journalText: msg
            }
          })
        });
        const data = await res.json();
        typing.classList.add('hidden');
        if (data.ok && data.data && data.data.text) {
          appendMessage('companion', data.data.text);
        } else {
          appendMessage('companion', 'I am spending a little time with your words. Thank you for sharing them here with me.');
        }
      } catch (e) {
        typing.classList.add('hidden');
        appendMessage('companion', 'I spent a little time with your words. Thank you for trusting this space.');
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSend();
    });

    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        chatPanel.classList.add('hidden');
        ratingPanel.classList.remove('hidden');
      });
    }

    // Rating selections
    $$('.weather-rating-card', ratingPanel).forEach(card => {
      card.addEventListener('click', () => {
        const weather = card.dataset.weather;
        saveWeatherRating('Nightstand', weather);

        ratingPanel.innerHTML = `
          <h2 class="display-sm" style="font-size:1.2rem; margin-bottom:12px;">Thank you for reflecting with me.</h2>
          <p class="lede lede-sm">Rest well tonight. We'll keep this room safe for you.</p>
          <button class="btn btn-primary" id="nightstand-done-btn" style="margin-top:16px;">Finish</button>
        `;
        
        $('#nightstand-done-btn').addEventListener('click', () => {
          location.reload();
        });
      });
    });

    const closeBtn = $('#nightstand-rating-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        location.reload();
      });
    }
  }

  function saveWeatherRating(room, weather) {
    const list = JSON.parse(localStorage.getItem('sukoon_weather_history') || '[]');
    list.push({
      date: new Date().toISOString(),
      room: room,
      weather: weather
    });
    localStorage.setItem('sukoon_weather_history', JSON.stringify(list));
    
    // Water plant when they complete a reflection session!
    let plantVisits = parseInt(localStorage.getItem('sukoon_plant_visits') || '0', 10);
    localStorage.setItem('sukoon_plant_visits', plantVisits + 1);
  }

  document.addEventListener('DOMContentLoaded', () => {
    decideView();
    initToggles();
    initSoundStubs();
  });
})();
