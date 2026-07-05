(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const selectorWrap = $('#mode-selector-wrap');
  const windowMode = $('#window-mode-container');
  const chairMode = $('#chair-mode-container');

  /* ============ Page Navigation Switches ============ */
  function showView(view) {
    selectorWrap.classList.toggle('hidden', view !== 'selector');
    windowMode.classList.toggle('hidden', view !== 'window');
    chairMode.classList.toggle('hidden', view !== 'chair');

    if (view === 'window') {
      startWindowScene('rain');
    } else {
      stopWindowScene();
    }
  }

  $('#select-window').addEventListener('click', () => showView('window'));
  $('#select-chair').addEventListener('click', () => showView('chair'));
  $('#exit-window-mode').addEventListener('click', () => showView('selector'));
  $('#exit-chair-mode').addEventListener('click', () => showView('selector'));

  /* ============ The Window Canvas Visual Loops ============ */
  const canvas = $('#window-canvas');
  const ctx = canvas.getContext('2d');
  let animationFrameId = null;
  let activeScene = null;
  let sceneTime = 0;

  let width = (canvas.width = canvas.offsetWidth || 500);
  let height = (canvas.height = canvas.offsetHeight || 380);

  window.addEventListener('resize', () => {
    if (windowMode.classList.contains('hidden')) return;
    width = (canvas.width = canvas.offsetWidth);
    height = (canvas.height = canvas.offsetHeight);
  });

  // Rain variables
  const rainDrops = [];
  const glassDroplets = [];
  // Ocean variables
  // Forest variables
  const windLeaves = [];
  // Campfire particles
  const embers = [];
  // Stars variables
  const stars = [];

  function initSceneState(scene) {
    rainDrops.length = 0;
    glassDroplets.length = 0;
    windLeaves.length = 0;
    embers.length = 0;
    stars.length = 0;
    sceneTime = 0;

    const noAnim = localStorage.getItem('thermostat_no_animations') === 'true';
    if (noAnim) return;

    if (scene === 'rain') {
      for (let i = 0; i < 40; i++) {
        rainDrops.push({ x: Math.random() * width, y: Math.random() * height, len: 10 + Math.random() * 20, vy: 4 + Math.random() * 6 });
      }
      for (let i = 0; i < 25; i++) {
        glassDroplets.push({ x: Math.random() * width, y: Math.random() * height, r: 1 + Math.random() * 3, vy: 0.1 + Math.random() * 0.4 });
      }
    } else if (scene === 'forest') {
      for (let i = 0; i < 20; i++) {
        windLeaves.push({ x: Math.random() * width, y: Math.random() * height, r: 2 + Math.random() * 4, vx: 1 + Math.random() * 2, vy: -0.2 + Math.random() * 0.4 });
      }
    } else if (scene === 'campfire') {
      for (let i = 0; i < 30; i++) {
        embers.push({ x: width / 2 - 20 + Math.random() * 40, y: height - 40, r: 1 + Math.random() * 3, vy: 0.5 + Math.random() * 1.5, vx: -0.3 + Math.random() * 0.6, op: 1 });
      }
    } else if (scene === 'sky') {
      for (let i = 0; i < 60; i++) {
        stars.push({ x: Math.random() * width, y: Math.random() * height, r: 0.5 + Math.random() * 1.5, op: Math.random(), delay: Math.random() * 100 });
      }
    }
  }

  function loop(time) {
    sceneTime += 1;
    const freeze = localStorage.getItem('thermostat_freeze_bg') === 'true' || 
                   localStorage.getItem('thermostat_no_animations') === 'true';

    ctx.clearRect(0, 0, width, height);

    if (activeScene === 'rain') {
      // Draw Rain Scene
      ctx.fillStyle = '#080E14';
      ctx.fillRect(0, 0, width, height);

      // Rain streaking
      ctx.strokeStyle = 'rgba(174, 214, 241, 0.25)';
      ctx.lineWidth = 1.5;
      rainDrops.forEach(d => {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 1, d.y + d.len);
        ctx.stroke();

        if (!freeze) {
          d.y += d.vy;
          if (d.y > height) {
            d.y = -20;
            d.x = Math.random() * width;
          }
        }
      });

      // Window droplets sliding down
      ctx.fillStyle = 'rgba(174, 214, 241, 0.4)';
      glassDroplets.forEach(d => {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();

        if (!freeze) {
          d.y += d.vy;
          if (Math.random() < 0.02) d.x += -1 + Math.random() * 2; // zig zag
          if (d.y > height) {
            d.y = -10;
            d.x = Math.random() * width;
          }
        }
      });

      // Draw window grid reflection
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2);
      ctx.stroke();

    } else if (activeScene === 'ocean') {
      // Draw Ocean waves
      ctx.fillStyle = '#0B1D28';
      ctx.fillRect(0, 0, width, height);

      const layers = [
        { color: 'rgba(28, 100, 120, 0.15)', freq: 0.005, amp: 20, speed: 0.015, yShift: 0.4 },
        { color: 'rgba(28, 100, 120, 0.25)', freq: 0.008, amp: 15, speed: -0.01, yShift: 0.55 },
        { color: 'rgba(11, 40, 60, 0.4)', freq: 0.012, amp: 10, speed: 0.005, yShift: 0.7 }
      ];

      layers.forEach(l => {
        ctx.fillStyle = l.color;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 10) {
          const shift = freeze ? 0 : sceneTime * l.speed;
          const y = height * l.yShift + Math.sin(x * l.freq + shift) * l.amp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      });

    } else if (activeScene === 'forest') {
      // Draw Forest swaying
      ctx.fillStyle = '#0E1A14';
      ctx.fillRect(0, 0, width, height);

      // Draw background hills/mountains
      ctx.fillStyle = 'rgba(24, 45, 35, 0.4)';
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(width * 0.3, height * 0.5, width * 0.6, height * 0.7);
      ctx.quadraticCurveTo(width * 0.8, height * 0.8, width, height * 0.65);
      ctx.lineTo(width, height);
      ctx.fill();

      // Draw swaying trees silhouettes
      const treeSway = freeze ? 0 : Math.sin(sceneTime * 0.02) * 2;
      ctx.fillStyle = '#060B08';
      
      // Tree 1
      ctx.save();
      ctx.translate(width * 0.25, height);
      ctx.rotate(treeSway * Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(0, -180); ctx.lineTo(10, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -180, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Tree 2
      const treeSway2 = freeze ? 0 : Math.sin(sceneTime * 0.015 + 1) * 3;
      ctx.save();
      ctx.translate(width * 0.7, height);
      ctx.rotate(treeSway2 * Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(-15, 0); ctx.lineTo(0, -220); ctx.lineTo(15, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -220, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Drifting leaves/spores
      ctx.fillStyle = 'rgba(154, 168, 139, 0.3)';
      windLeaves.forEach(l => {
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
        ctx.fill();

        if (!freeze) {
          l.x += l.vx;
          l.y += l.vy;
          if (l.x > width) {
            l.x = -10;
            l.y = Math.random() * height;
          }
        }
      });

    } else if (activeScene === 'train') {
      // Draw passing landscape from train window
      ctx.fillStyle = '#0A050B';
      ctx.fillRect(0, 0, width, height);

      // Distant stars/mountains (moves slow)
      ctx.fillStyle = '#180E1C';
      ctx.beginPath();
      ctx.moveTo(0, height);
      const hillsFreq = 0.003;
      const hillsShift = freeze ? 0 : sceneTime * 0.005;
      for (let x = 0; x <= width; x += 15) {
        ctx.lineTo(x, height * 0.5 + Math.sin(x * hillsFreq + hillsShift) * 15);
      }
      ctx.lineTo(width, height);
      ctx.fill();

      // Near ground (moves very fast horizontal)
      ctx.fillStyle = '#08040A';
      ctx.beginPath();
      ctx.moveTo(0, height);
      const groundShift = freeze ? 0 : sceneTime * 0.12;
      for (let x = 0; x <= width; x += 20) {
        ctx.lineTo(x, height * 0.75 + Math.sin(x * 0.05 + groundShift) * 4);
      }
      ctx.lineTo(width, height);
      ctx.fill();

      // Train window frame mask overlay
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#1D1322';
      ctx.strokeRect(7, 7, width - 14, height - 14);

    } else if (activeScene === 'campfire') {
      // Draw campfire
      ctx.fillStyle = '#0D0805';
      ctx.fillRect(0, 0, width, height);

      // Base log structures
      ctx.strokeStyle = '#271A10';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 50, height - 20); ctx.lineTo(width / 2 + 50, height - 35);
      ctx.moveTo(width / 2 - 40, height - 35); ctx.lineTo(width / 2 + 40, height - 20);
      ctx.stroke();

      // Flame glow
      const glowRad = freeze ? 100 : 90 + Math.sin(sceneTime * 0.08) * 15;
      const glow = ctx.createRadialGradient(width/2, height-40, 5, width/2, height-40, glowRad);
      glow.addColorStop(0, 'rgba(230, 126, 34, 0.45)');
      glow.addColorStop(0.3, 'rgba(241, 196, 15, 0.2)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(width/2, height-40, glowRad, 0, Math.PI*2);
      ctx.fill();

      // Rising embers
      embers.forEach(e => {
        ctx.fillStyle = `rgba(243, 156, 18, ${e.op})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();

        if (!freeze) {
          e.y -= e.vy;
          e.x += e.vx;
          e.op -= 0.007;

          if (e.op <= 0 || e.y < 0) {
            e.y = height - 40;
            e.x = width / 2 - 20 + Math.random() * 40;
            e.op = 0.8 + Math.random() * 0.2;
            e.vy = 0.5 + Math.random() * 1.5;
          }
        }
      });

    } else if (activeScene === 'sky') {
      // Draw Night sky
      ctx.fillStyle = '#020206';
      ctx.fillRect(0, 0, width, height);

      // Soft nebula glow
      const nebula = ctx.createRadialGradient(width * 0.3, height * 0.3, 10, width * 0.3, height * 0.3, 200);
      nebula.addColorStop(0, 'rgba(41, 128, 185, 0.08)');
      nebula.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebula;
      ctx.beginPath();
      ctx.arc(width * 0.3, height * 0.3, 200, 0, Math.PI*2);
      ctx.fill();

      // Twinkling stars
      stars.forEach(s => {
        let op = s.op;
        if (!freeze) {
          op = 0.15 + Math.abs(Math.sin((sceneTime + s.delay) * 0.04)) * 0.8;
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${op})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    animationFrameId = requestAnimationFrame(loop);
  }

  /* ============ Web Audio Ambient Sound Synthesizers ============ */
  let audioCtx = null;
  let soundNodes = [];
  let isMuted = false;

  function stopAllSounds() {
    soundNodes.forEach(n => { try { n.stop(); } catch (e) {} });
    soundNodes = [];
  }

  function startSceneSound(scene) {
    stopAllSounds();
    if (isMuted || localStorage.getItem('thermostat_mute_audio') === 'true') return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) audioCtx = new AudioCtx();

    const gain = audioCtx.createGain();
    gain.gain.value = 0.035;
    gain.connect(audioCtx.destination);

    if (scene === 'rain') {
      // Synthesize rain noise
      const bufferSize = 2 * audioCtx.sampleRate;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.35;

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;

      noise.connect(filter).connect(gain);
      noise.start();
      soundNodes = [noise];

    } else if (scene === 'ocean') {
      // Synthesize rolling ocean waves (modulated noise filter frequency/gain)
      const bufferSize = 2 * audioCtx.sampleRate;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 350;

      noise.connect(filter).connect(gain);
      noise.start();

      // Periodically modulate the gain value using LFO simulator
      let time = 0;
      const interval = setInterval(() => {
        if (soundNodes.length === 0) { clearInterval(interval); return; }
        time += 0.05;
        const targetGain = 0.01 + (Math.sin(time) * 0.5 + 0.5) * 0.045;
        gain.gain.setValueAtTime(targetGain, audioCtx.currentTime);
      }, 50);

      soundNodes = [noise];

    } else if (scene === 'forest') {
      // Synthesize wind filtered noise + occasional chirps
      const bufferSize = 2 * audioCtx.sampleRate;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.2;

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;

      noise.connect(filter).connect(gain);
      noise.start();

      // Bird chirp synth function
      const playChirp = () => {
        if (soundNodes.length === 0) return;
        const osc = audioCtx.createOscillator();
        const chirpGain = audioCtx.createGain();
        chirpGain.gain.setValueAtTime(0.005, audioCtx.currentTime);
        chirpGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.2);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.5);

        osc.connect(chirpGain).connect(audioCtx.destination);
        osc.start();
        setTimeout(() => { try { osc.stop(); } catch(e){} }, 600);
      };

      const birdTimer = setInterval(() => {
        if (soundNodes.length === 0) { clearInterval(birdTimer); return; }
        if (Math.random() < 0.4) playChirp();
      }, 4000);

      soundNodes = [noise];

    } else if (scene === 'train') {
      // Train tracks click (rhythmic click pattern)
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 60; // low dummy hum so the sound nodes list remains populated
      osc.connect(gain);
      osc.start();

      const playClack = () => {
        if (soundNodes.length === 0) return;
        const ctxTime = audioCtx.currentTime;
        // Make two quick click impulses
        [0, 0.12].forEach(delay => {
          const clickOsc = audioCtx.createOscillator();
          clickOsc.type = 'triangle';
          clickOsc.frequency.setValueAtTime(40, ctxTime + delay);
          const clickGain = audioCtx.createGain();
          clickGain.gain.setValueAtTime(0.06, ctxTime + delay);
          clickGain.gain.exponentialRampToValueAtTime(0.0001, ctxTime + delay + 0.08);

          clickOsc.connect(clickGain).connect(audioCtx.destination);
          clickOsc.start();
          setTimeout(() => { try { clickOsc.stop(); } catch(e){} }, 200);
        });
      };

      const clackTimer = setInterval(() => {
        if (soundNodes.length === 0) { clearInterval(clackTimer); return; }
        playClack();
      }, 2400);

      soundNodes = [osc];

    } else if (scene === 'campfire') {
      // Synthesize campfire crackle and low rumble
      const lowOsc = audioCtx.createOscillator();
      lowOsc.type = 'triangle';
      lowOsc.frequency.value = 60;
      const lowGain = audioCtx.createGain();
      lowGain.gain.value = 0.02;
      lowOsc.connect(lowGain).connect(audioCtx.destination);
      lowOsc.start();

      const playCrackle = () => {
        if (soundNodes.length === 0) return;
        const crackOsc = audioCtx.createOscillator();
        crackOsc.type = 'sawtooth';
        crackOsc.frequency.setValueAtTime(600 + Math.random() * 800, audioCtx.currentTime);
        const crackGain = audioCtx.createGain();
        crackGain.gain.setValueAtTime(0.008, audioCtx.currentTime);
        crackGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.03);

        const bandpass = audioCtx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 1000;

        crackOsc.connect(bandpass).connect(crackGain).connect(audioCtx.destination);
        crackOsc.start();
        setTimeout(() => { try { crackOsc.stop(); } catch(e){} }, 100);
      };

      const crackleTimer = setInterval(() => {
        if (soundNodes.length === 0) { clearInterval(crackleTimer); return; }
        if (Math.random() < 0.3) playCrackle();
      }, 200);

      soundNodes = [lowOsc];

    } else if (scene === 'sky') {
      // Twinkling detuned chord pad (C major 7th chord drone)
      const frequencies = [130.81, 164.81, 196.00, 246.94]; // C3, E3, G3, B3
      const oscs = frequencies.map(freq => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq + (Math.random() * 0.6 - 0.3); // slight detuning
        
        const oscGain = audioCtx.createGain();
        oscGain.gain.value = 0.015;
        osc.connect(oscGain).connect(gain);
        osc.start();
        return osc;
      });

      soundNodes = oscs;
    }
  }

  function startWindowScene(scene) {
    activeScene = scene;
    initSceneState(scene);
    stopWindowScene(); // stop previous loops
    
    loop(0);
    startSceneSound(scene);

    // Update overlay desc
    const descs = {
      rain: 'Rain sliding down a window pane...',
      ocean: 'Gentle waves rolling in and out...',
      forest: 'Trees swaying gently under open skies...',
      train: 'Passing hills from a passenger train...',
      campfire: 'A small campfire warming the dusk...',
      sky: 'Stars twinkling in a quiet nebula...'
    };
    $('#window-overlay-desc').textContent = descs[scene] || '';
  }

  function stopWindowScene() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    stopAllSounds();
  }

  // Scene Nav click bindings
  $$('.scene-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.scene-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      startWindowScene(btn.dataset.scene);
    });
  });

  // Mute audio button binding
  const muteBtn = $('#mute-window-sound');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      muteBtn.textContent = isMuted ? '🔇 Muted' : '🔊 Sound On';
      if (isMuted) {
        stopAllSounds();
      } else {
        if (activeScene) startSceneSound(activeScene);
      }
    });
  }

  // Bind to thermostat settings change to toggle sound/anim state
  document.addEventListener('sukoon-environment-change', () => {
    if (activeScene) {
      startWindowScene(activeScene);
    }
  });


  /* ============ The Empty Chair Logic ============ */
  let activePerson = '';
  const setupDiv = $('#chair-setup');
  const workspaceDiv = $('#chair-workspace');
  const reflectionDiv = $('#chair-reflection');
  const inputEl = $('#chair-input');

  $$('.chair-person-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activePerson = btn.dataset.person;
      $('#chair-speaking-to').textContent = `speaking to: ${activePerson}`;
      setupDiv.classList.add('hidden');
      workspaceDiv.classList.remove('hidden');
      
      // Greet empty draft backup
      inputEl.value = localStorage.getItem(`sukoon_chair_draft_${activePerson}`) || '';
      inputEl.focus();
    });
  });

  inputEl.addEventListener('input', () => {
    if (activePerson) {
      localStorage.setItem(`sukoon_chair_draft_${activePerson}`, inputEl.value);
    }
  });

  $('#chair-submit').addEventListener('click', async () => {
    const text = inputEl.value.trim();
    if (!text) return;

    $('#chair-submit').disabled = true;
    $('#chair-submit').textContent = 'Reflection visiting...';

    // Clear draft
    if (activePerson) {
      localStorage.removeItem(`sukoon_chair_draft_${activePerson}`);
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'companion',
          payload: {
            emotion: `Empty Chair (${activePerson})`,
            journalText: text
          }
        })
      });
      const data = await res.json();
      workspaceDiv.classList.add('hidden');
      reflectionDiv.classList.remove('hidden');
      
      if (data.ok && data.data && data.data.text) {
        $('#chair-reflection-text').textContent = data.data.text;
      } else {
        $('#chair-reflection-text').textContent = 'I spent a little time with your words. Thank you for sharing them here in this chair. Rest in this space for a while.';
      }
      
      // Water plant
      let plantVisits = parseInt(localStorage.getItem('sukoon_plant_visits') || '0', 10);
      localStorage.setItem('sukoon_plant_visits', plantVisits + 1);

    } catch(e) {
      workspaceDiv.classList.add('hidden');
      reflectionDiv.classList.remove('hidden');
      $('#chair-reflection-text').textContent = 'I spent a little time with your words. Some thoughts aren’t meant to be carried alone.';
    } finally {
      $('#chair-submit').disabled = false;
      $('#chair-submit').textContent = "I've said what I needed to say";
    }
  });

  $('#chair-reset').addEventListener('click', () => {
    inputEl.value = '';
    reflectionDiv.classList.add('hidden');
    setupDiv.classList.remove('hidden');
  });

})();
