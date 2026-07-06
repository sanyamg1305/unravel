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
    const dontKnowBtn = $('#dont-know-feeling');
    const needsPanel = $('#needs-panel');

    if (dontKnowBtn && needsPanel) {
      dontKnowBtn.addEventListener('click', () => {
        needsPanel.classList.toggle('hidden');
        if (!needsPanel.classList.contains('hidden')) {
          needsPanel.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

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

  const MOODS_DATABASE = {
    // Sadness / Heavy
    "depressed": "living-room.html?emotion=Sad",
    "gloomy": "living-room.html?emotion=Sad",
    "melancholy": "living-room.html?emotion=Sad",
    "despondent": "living-room.html?emotion=Sad",
    "heartbroken": "living-room.html?emotion=Sad",
    "sorrowful": "living-room.html?emotion=Sad",
    "blue": "living-room.html?emotion=Sad",
    "disappointed": "living-room.html?emotion=Sad",
    "hurt": "living-room.html?emotion=Sad",
    "tearful": "living-room.html?emotion=Sad",
    "exhausted": "living-room.html?emotion=Sad",
    "hopeless": "living-room.html?emotion=Sad",
    "regretful": "living-room.html?emotion=Sad",
    "dejected": "living-room.html?emotion=Sad",
    "weary": "living-room.html?emotion=Sad",
    "defeated": "living-room.html?emotion=Sad",
    "vulnerable": "living-room.html?emotion=Sad",
    "distressed": "living-room.html?emotion=Sad",
    "mournful": "living-room.html?emotion=Sad",
    "miserable": "living-room.html?emotion=Sad",
    "down": "living-room.html?emotion=Sad",

    // Anxious / Restless
    "panicked": "garden.html?emotion=Anxious",
    "worried": "garden.html?emotion=Anxious",
    "stressed": "garden.html?emotion=Anxious",
    "nervous": "garden.html?emotion=Anxious",
    "apprehensive": "garden.html?emotion=Anxious",
    "restless": "garden.html?emotion=Anxious",
    "frightened": "garden.html?emotion=Anxious",
    "tense": "garden.html?emotion=Anxious",
    "agitated": "garden.html?emotion=Anxious",
    "dread": "garden.html?emotion=Anxious",
    "uneasy": "garden.html?emotion=Anxious",
    "shaky": "garden.html?emotion=Anxious",
    "insecure": "garden.html?emotion=Anxious",
    "distracted": "garden.html?emotion=Anxious",
    "hyperactive": "garden.html?emotion=Anxious",
    "paralyzed": "garden.html?emotion=Anxious",
    "scattered": "garden.html?emotion=Anxious",
    "scared": "garden.html?emotion=Anxious",
    "jittery": "garden.html?emotion=Anxious",

    // Angry / Irritated
    "furious": "garden.html?emotion=Angry",
    "annoyed": "garden.html?emotion=Angry",
    "frustrated": "garden.html?emotion=Angry",
    "resentful": "garden.html?emotion=Angry",
    "bitter": "garden.html?emotion=Angry",
    "hostile": "garden.html?emotion=Angry",
    "outraged": "garden.html?emotion=Angry",
    "mad": "garden.html?emotion=Angry",
    "impatient": "garden.html?emotion=Angry",
    "cynical": "garden.html?emotion=Angry",
    "grumpy": "garden.html?emotion=Angry",
    "vengeful": "garden.html?emotion=Angry",
    "envious": "garden.html?emotion=Angry",
    "jealous": "garden.html?emotion=Angry",
    "indignant": "garden.html?emotion=Angry",
    "defensive": "garden.html?emotion=Angry",
    "sullen": "garden.html?emotion=Angry",
    "spiteful": "garden.html?emotion=Angry",
    "offended": "garden.html?emotion=Angry",

    // Lonely / Isolated
    "abandoned": "attic.html?emotion=Lonely",
    "excluded": "attic.html?emotion=Lonely",
    "isolated": "attic.html?emotion=Lonely",
    "misunderstood": "attic.html?emotion=Lonely",
    "ignored": "attic.html?emotion=Lonely",
    "neglected": "attic.html?emotion=Lonely",
    "homesick": "attic.html?emotion=Lonely",
    "alienated": "attic.html?emotion=Lonely",
    "forgotten": "attic.html?emotion=Lonely",
    "rejected": "attic.html?emotion=Lonely",
    "withdrawn": "attic.html?emotion=Lonely",
    "desolate": "attic.html?emotion=Lonely",
    "outcast": "attic.html?emotion=Lonely",
    "unwanted": "attic.html?emotion=Lonely",
    "unseen": "attic.html?emotion=Lonely",
    "lonely": "attic.html?emotion=Lonely",
    "alone": "attic.html?emotion=Lonely",

    // Guilty / Ashamed
    "guilty": "attic.html?emotion=Guilty",
    "ashamed": "attic.html?emotion=Guilty",
    "remorseful": "attic.html?emotion=Guilty",
    "regretful": "attic.html?emotion=Guilty",
    "embarrassed": "attic.html?emotion=Guilty",
    "humiliated": "attic.html?emotion=Guilty",
    "mortified": "attic.html?emotion=Guilty",
    "sheepish": "attic.html?emotion=Guilty",
    "contrite": "attic.html?emotion=Guilty",
    "apologetic": "attic.html?emotion=Guilty",
    "self-critical": "attic.html?emotion=Guilty",
    "unworthy": "attic.html?emotion=Guilty",
    "disgraced": "attic.html?emotion=Guilty",
    "at fault": "attic.html?emotion=Guilty",
    "responsible": "attic.html?emotion=Guilty",

    // Grieving / Mourning
    "grieving": "living-room.html?emotion=Grieving",
    "mourning": "living-room.html?emotion=Grieving",
    "bereaved": "living-room.html?emotion=Grieving",
    "heartbroken": "living-room.html?emotion=Grieving",
    "loss": "living-room.html?emotion=Grieving",
    "missing them": "living-room.html?emotion=Grieving",
    "longing": "living-room.html?emotion=Grieving",
    "nostalgic": "living-room.html?emotion=Grieving",
    "heavy-hearted": "living-room.html?emotion=Grieving",
    "aching": "living-room.html?emotion=Grieving",
    "wistful": "living-room.html?emotion=Grieving",
    "grief-stricken": "living-room.html?emotion=Grieving",
    "in mourning": "living-room.html?emotion=Grieving",
    "lost someone": "living-room.html?emotion=Grieving",

    // Numb / Empty / Disconnected
    "numb": "attic.html?emotion=Empty",
    "empty": "attic.html?emotion=Empty",
    "hollow": "attic.html?emotion=Empty",
    "blank": "attic.html?emotion=Empty",
    "detached": "attic.html?emotion=Empty",
    "indifferent": "attic.html?emotion=Empty",
    "apathetic": "attic.html?emotion=Empty",
    "disconnected": "attic.html?emotion=Empty",
    "void": "attic.html?emotion=Empty",
    "flat": "attic.html?emotion=Empty",
    "checked out": "attic.html?emotion=Empty",
    "zoned out": "attic.html?emotion=Empty",
    "dissociated": "attic.html?emotion=Empty",
    "unfeeling": "attic.html?emotion=Empty",

    // Overwhelmed / Overloaded
    "overwhelmed": "garden.html?emotion=Overwhelmed",
    "swamped": "garden.html?emotion=Overwhelmed",
    "buried": "garden.html?emotion=Overwhelmed",
    "drowning": "garden.html?emotion=Overwhelmed",
    "overloaded": "garden.html?emotion=Overwhelmed",
    "maxed out": "garden.html?emotion=Overwhelmed",
    "out of my depth": "garden.html?emotion=Overwhelmed",
    "can't cope": "garden.html?emotion=Overwhelmed",
    "too much": "garden.html?emotion=Overwhelmed",
    "spiraling": "garden.html?emotion=Overwhelmed",
    "frazzled": "garden.html?emotion=Overwhelmed",
    "overextended": "garden.html?emotion=Overwhelmed",
    "burnt out": "garden.html?emotion=Overwhelmed",
    "burned out": "garden.html?emotion=Overwhelmed",
    "at capacity": "garden.html?emotion=Overwhelmed"
  };

  function initMoodSearch() {
    const input = $('#mood-search-input');
    const suggestions = $('#mood-search-suggestions');
    if (!input || !suggestions) return;

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        suggestions.classList.add('hidden');
        return;
      }

      // Filter matches
      const matches = Object.keys(MOODS_DATABASE).filter(mood => mood.includes(q));

      if (matches.length === 0) {
        suggestions.innerHTML = '<p class="fineprint" style="margin: 0; padding: 6px 12px;">No matching feelings found. Choose a need below.</p>';
      } else {
        suggestions.innerHTML = matches.map(mood => `
          <a href="${MOODS_DATABASE[mood]}" class="suggestion-item" style="display: block; padding: 8px 12px; text-decoration: none; font-weight: 600; color: var(--ink); border-radius: var(--radius-sm); transition: background 0.2s;">
            ${mood.charAt(0).toUpperCase() + mood.slice(1)}
          </a>
        `).join('');
        
        $$('.suggestion-item', suggestions).forEach(item => {
          item.addEventListener('mouseenter', () => { item.style.background = 'var(--parchment-deep)'; });
          item.addEventListener('mouseleave', () => { item.style.background = 'none'; });
        });
      }

      suggestions.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !suggestions.contains(e.target)) {
        suggestions.classList.add('hidden');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    decideView();
    initToggles();
    initSoundStubs();
    initMoodSearch();
  });
})();
