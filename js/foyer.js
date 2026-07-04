(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);

  const NIGHTSTAND_OVERRIDE_KEY = 'sukoon_nightstand_override';

  function decideView() {
    const foyer = $('#foyer-view');
    const nightstand = $('#nightstand-view');
    const override = sessionStorage.getItem(NIGHTSTAND_OVERRIDE_KEY);

    let showNightstand;
    if (override === 'foyer') showNightstand = false;
    else if (override === 'nightstand') showNightstand = true;
    else showNightstand = window.Sukoon ? window.Sukoon.isNightHours() : false;

    foyer.classList.toggle('hidden', showNightstand);
    nightstand.classList.toggle('hidden', !showNightstand);
  }

  function initToggles() {
    $('#goto-nightstand').addEventListener('click', () => {
      sessionStorage.setItem(NIGHTSTAND_OVERRIDE_KEY, 'nightstand');
      decideView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    $('#goto-foyer').addEventListener('click', () => {
      sessionStorage.setItem(NIGHTSTAND_OVERRIDE_KEY, 'foyer');
      decideView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // simple oscillator-based ambient tone stand-in for the Nightstand's sound
  // window, since no external audio files ship with this build
  let activeOscillators = [];
  function stopAllTones() {
    activeOscillators.forEach(o => { try { o.stop(); } catch (e) {} });
    activeOscillators = [];
  }
  function playTone(kind, btn) {
    stopAllTones();
    document.querySelectorAll('[data-track]').forEach(b => { b.textContent = '▶'; });
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
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
      filter.frequency.value = 500;
      noise.connect(filter).connect(gain);
      noise.start();
      activeOscillators = [noise];
    } else {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 528;
      osc.connect(gain);
      osc.start();
      activeOscillators = [osc];
    }
    btn.textContent = '⏸';
  }

  function initSoundStubs() {
    document.querySelectorAll('[data-track]').forEach(btn => {
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

  document.addEventListener('DOMContentLoaded', () => {
    decideView();
    initToggles();
    initSoundStubs();
  });
})();
