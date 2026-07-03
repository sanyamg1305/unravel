(() => {
  'use strict';

  /* ============ Data ============ */

  const EMOTIONS = [
    { id: 'overwhelmed', label: 'Overwhelmed', color: '#c6a9c9' },
    { id: 'anxious',     label: 'Anxious',     color: '#7d87a8' },
    { id: 'sad',         label: 'Sad',         color: '#8fa8c2' },
    { id: 'angry',       label: 'Angry',       color: '#cf9a76' },
    { id: 'lonely',      label: 'Lonely',      color: '#a89bc2' },
    { id: 'burntout',    label: 'Burnt Out',   color: '#c2a17d' },
    { id: 'empty',       label: 'Empty',       color: '#9b9587' },
    { id: 'guilty',      label: 'Guilty',      color: '#b0a08f' },
    { id: 'confused',    label: 'Confused',    color: '#8fa88f' },
    { id: 'grieving',    label: 'Grieving',    color: '#8a94a8' },
    { id: 'stressed',    label: 'Stressed',    color: '#cf8f8f' },
    { id: 'other',       label: 'Other',       color: '#b5b0a3' },
  ];

  const HEAVIEST = [
    { id: 'work',        label: 'Work' },
    { id: 'school',      label: 'School' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'family',      label: 'Family' },
    { id: 'money',       label: 'Money' },
    { id: 'health',      label: 'Health' },
    { id: 'thoughts',    label: 'My thoughts' },
    { id: 'everything',  label: 'Everything' },
    { id: 'unsure',      label: "I don't know" },
  ];

  const STARTER_PROMPTS = [
    "What's hurting the most today?",
    "What thought keeps coming back?",
    "What are you pretending doesn't bother you?",
    "What would you tell someone you love if they felt this way?",
  ];

  const HOPE_LIBRARY = [
    "You survived every difficult day that brought you here.",
    "You don't need to have everything figured out.",
    "Your emotions aren't problems to solve. They're experiences to understand.",
    "Rest is productive when your mind needs it.",
    "Being overwhelmed doesn't mean you're failing.",
    "Small steps still move you forward.",
  ];

  const TINY_STEPS = [
    "Drink a glass of water.",
    "Listen to your favorite song.",
    "Step outside for five minutes.",
    "Text someone you trust.",
    "Stretch for two minutes.",
  ];

  const SELF_HARM_KEYWORDS = [
    'kill myself', 'killing myself', 'suicide', 'suicidal',
    'end my life', 'ending my life', 'end it all', 'ending it all',
    'want to die', 'wanted to die', 'wish i was dead', 'wish i were dead',
    'want to live anymore', "want to be alive", "wish i wasn't here", "wish i wasn't alive",
    "don't want to live", 'do not want to live', "dont want to live",
    'no reason to live', 'no point in living', 'no point living',
    'hurt myself', 'hurting myself', 'self harm', 'self-harm',
    "can't go on", 'cant go on', "can't do this anymore", 'cant do this anymore',
    'better off dead', 'not worth living', 'give up on life', 'giving up on life',
    'disappear forever', "not be here anymore", 'plan to kill', 'ready to die',
  ];

  const HARM_TO_OTHERS_KEYWORDS = [
    'kill him', 'kill her', 'kill them', 'kill someone',
    'hurt him', 'hurt her', 'hurt them', 'hurt someone',
    'going to hurt', 'want to hurt', 'gonna hurt',
    'make them pay', 'make him pay', 'make her pay',
    'end his life', 'end her life', 'end their life',
    'beat him up', 'beat her up',
  ];

  // naive keyword -> theme mapping used to build the reflection / mirror
  const THEME_MAP = [
    { theme: 'Fear of failure', words: ['fail', 'failure', 'not good enough', 'mess up', 'screw up', 'disappoint'] },
    { theme: 'Expectations from others', words: ['expect', 'expectation', 'pressure', 'should', 'supposed to'] },
    { theme: 'Racing thoughts', words: ['sleep', 'tired', 'exhausted', 'racing', "can't stop thinking", 'overthink'] },
    { theme: 'Money worries', words: ['money', 'debt', 'afford', 'bills', 'rent', 'broke'] },
    { theme: 'Feeling alone', words: ['alone', 'lonely', 'no one', 'nobody', 'isolated'] },
    { theme: 'Self-doubt', words: ['not enough', 'stupid', 'worthless', 'hate myself', 'not smart'] },
    { theme: 'Guilt', words: ['guilty', 'my fault', 'blame myself', 'sorry'] },
    { theme: 'Conflict', words: ['fight', 'argument', 'yelled', 'broke up', 'fought'] },
    { theme: 'Uncertainty', words: ["don't know", 'confused', 'lost', 'unsure', 'what if'] },
  ];

  const STORAGE_KEY = 'unravel_entries';

  /* ============ State ============ */

  const state = {
    emotion: null,
    heaviest: null,
    journalText: '',
    mode: 'type',
    weight: null,
    riskFlagged: false,
    history: ['screen-landing'],
    promptIndex: 0,
  };

  /* ============ Helpers ============ */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function showScreen(id, { pushHistory = true } = {}) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    if (pushHistory) state.history.push(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack(targetId) {
    showScreen(targetId, { pushHistory: false });
    const idx = state.history.indexOf(targetId);
    state.history = idx >= 0 ? state.history.slice(0, idx + 1) : [targetId];
  }

  function detectRisk(text) {
    const lower = text.toLowerCase();
    const selfHarm = SELF_HARM_KEYWORDS.some(k => lower.includes(k));
    const otherHarm = HARM_TO_OTHERS_KEYWORDS.some(k => lower.includes(k));
    return selfHarm || otherHarm;
  }

  function extractThemes(text) {
    const lower = text.toLowerCase();
    const found = THEME_MAP.filter(t => t.words.some(w => lower.includes(w)));
    return found.map(t => t.theme).slice(0, 3);
  }

  function loadEntries() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveEntries(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      // localStorage unavailable, fail silently, nothing was ever sent anywhere
    }
  }

  let toastTimer = null;
  function flashToast(msg) {
    let toast = $('#toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = `
        position:fixed; bottom:28px; left:50%; transform:translateX(-50%) translateY(20px);
        background:var(--ink); color:var(--surface); padding:12px 22px; border-radius:999px;
        font-size:0.85rem; z-index:50; opacity:0; transition: all 0.35s ease; max-width: 90vw; text-align:center;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    clearTimeout(toastTimer);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 3200);
  }

  /* ============ Landing ============ */

  function initLanding() {
    $('#btn-begin').addEventListener('click', () => {
      renderEmotionGrid();
      showScreen('screen-compass');
    });
  }

  function renderEmotionGrid() {
    const grid = $('#emotion-grid');
    if (grid.dataset.rendered) return;
    grid.dataset.rendered = '1';
    grid.innerHTML = EMOTIONS.map(e => `
      <button class="emotion-card" data-emotion="${e.id}" data-label="${e.label}">
        <span class="blob" style="background:${e.color}"></span>
        ${e.label}
      </button>
    `).join('');

    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.emotion-card');
      if (!card) return;
      state.emotion = { id: card.dataset.emotion, label: card.dataset.label };

      if (card.dataset.emotion === 'other') {
        openOtherEmotionPrompt();
        return;
      }

      $('#heaviest-eyebrow').textContent = `you're feeling ${state.emotion.label.toLowerCase()}`;
      renderHeaviestGrid();
      showScreen('screen-heaviest');
    });
  }

  function openOtherEmotionPrompt() {
    const wrap = $('#emotion-other-wrap');
    const input = $('#emotion-other-input');
    wrap.classList.remove('hidden');
    input.value = '';
    input.focus();
  }

  /* ============ Heaviest drill-down ============ */

  function renderHeaviestGrid() {
    const grid = $('#heaviest-grid');
    grid.innerHTML = HEAVIEST.map(h => `
      <button class="choice-chip" data-heaviest="${h.id}" data-label="${h.label}">${h.label}</button>
    `).join('');

    grid.querySelectorAll('.choice-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        grid.querySelectorAll('.choice-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        state.heaviest = { id: chip.dataset.heaviest, label: chip.dataset.label };
        setTimeout(() => showScreen('screen-transition'), 220);
      });
    });
  }

  /* ============ Transition (breathing pause) ============ */

  let transitionTimer = null;
  function initTransition() {
    $('#btn-skip-transition').addEventListener('click', enterSafeRoom);
  }

  function enterTransition() {
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(enterSafeRoom, 2800);
  }

  function enterSafeRoom() {
    clearTimeout(transitionTimer);
    if (!$('#screen-saferoom').classList.contains('active')) {
      showScreen('screen-saferoom');
    }
  }

  /* ============ Safe room ============ */

  const MODE_PLACEHOLDERS = {
    type: 'Start with one word if that’s all you have today.',
    letter: "Dear someone,\n\nI need to tell you something I haven't said out loud yet…",
  };

  function initSafeRoom() {
    const textarea = $('#journal-input');
    const wordCount = $('#word-count');
    const continueBtn = $('#btn-to-weight');

    textarea.addEventListener('input', () => {
      const words = textarea.value.trim().split(/\s+/).filter(Boolean);
      wordCount.textContent = `${words.length} word${words.length === 1 ? '' : 's'}`;
      continueBtn.disabled = words.length < 1;
    });

    $$('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === 'voice' || mode === 'draw') {
          flashToast(`${btn.textContent.trim()} is coming soon. For now, typing works beautifully too.`);
          return;
        }
        $$('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = mode;
        textarea.placeholder = MODE_PLACEHOLDERS[mode] || MODE_PLACEHOLDERS.type;
        textarea.focus();
      });
    });

    $('#btn-prompt-help').addEventListener('click', () => {
      const suggestion = $('#prompt-suggestion');
      const prompt = STARTER_PROMPTS[state.promptIndex % STARTER_PROMPTS.length];
      state.promptIndex += 1;
      suggestion.textContent = `"${prompt}"`;
      suggestion.classList.remove('hidden');
      if (!textarea.value.trim()) {
        textarea.focus();
      }
    });

    continueBtn.addEventListener('click', () => {
      state.journalText = textarea.value.trim();
      showScreen('screen-weight');
    });
  }

  /* ============ Emotional weight (post-writing, skippable) ============ */

  function initWeight() {
    const slider = $('#weight-slider');
    const value = $('#weight-value');
    slider.addEventListener('input', () => { value.textContent = slider.value; });

    $('#btn-ready').addEventListener('click', () => {
      state.weight = parseInt(slider.value, 10);
      enterReadingPause();
    });

    $('#btn-skip-weight').addEventListener('click', () => {
      state.weight = null;
      enterReadingPause();
    });
  }

  /* ============ Reading with care (silent risk check) ============ */

  function enterReadingPause() {
    showScreen('screen-reading');
    state.riskFlagged = detectRisk(state.journalText);
    setTimeout(() => {
      if (state.riskFlagged) {
        showScreen('screen-safety-pause');
      } else {
        buildReflection();
        showScreen('screen-reflection');
      }
    }, 1600);
  }

  /* ============ Safety Pause ============ */

  function initSafetyPause() {
    $('#btn-safety-save').addEventListener('click', () => {
      persistEntry();
      showScreen('screen-keep-saved');
    });

    $('#btn-safety-leave').addEventListener('click', () => {
      showGoodbye('left');
      showScreen('screen-goodbye');
    });
  }

  /* ============ Reflection + Emotional Mirror ============ */

  function buildReflection() {
    const emotionLabel = state.emotion ? state.emotion.label.toLowerCase() : 'a lot right now';
    const heaviestLabel = state.heaviest ? state.heaviest.label.toLowerCase() : 'a lot of things';
    const themes = extractThemes(state.journalText);

    let text = `It looks like ${heaviestLabel === "i don't know" ? "it's hard to even name what's weighing on you" : `${heaviestLabel} might be weighing on you`} right now, and that could be showing up as feeling ${emotionLabel}. `;

    if (themes.length >= 2) {
      const lowerThemes = themes.map(t => t.toLowerCase());
      text += `A few things stand out in what you wrote, especially around ${lowerThemes.slice(0, -1).join(', ')} and ${lowerThemes[lowerThemes.length - 1]}. This could be one thread worth noticing: these can build on each other and make even small tasks feel heavier than they are. `;
    } else if (themes.length === 1) {
      text += `Something about ${themes[0].toLowerCase()} stands out in what you wrote. You might find it's sitting close to the surface right now. `;
    } else {
      text += `Thank you for putting this into words. That alone takes something. `;
    }

    text += `You don't have to have this figured out right now. Just naming it is a real step.`;
    $('#reflection-text').textContent = text;

    renderMirror(themes);
  }

  function renderMirror(themes) {
    const root = state.emotion ? state.emotion.label : 'What you’re carrying';
    const branch = state.heaviest ? state.heaviest.label : 'Everything';
    const leaves = themes.length ? themes : deriveFallbackLeaves();

    const leafHTML = leaves.map(l => `
      <div class="mirror-leaf-line"></div>
      <div class="mirror-leaf">${l}</div>
    `).join('');

    $('#mirror-diagram').innerHTML = `
      <div class="mirror-root">${root}</div>
      <div class="mirror-trunk"></div>
      <div class="mirror-branches">
        <div class="mirror-branch">
          <div class="mirror-branch-line"></div>
          <div class="mirror-branch-node">${branch}</div>
          ${leafHTML}
        </div>
      </div>
    `;

    const insight = leaves.length
      ? `It looks like your biggest weight here might not be ${branch.toLowerCase()} itself. Maybe it's ${leaves[0].toLowerCase()} sitting underneath it. Worth noticing, not a certainty.`
      : `Right now, ${branch.toLowerCase()} looks like the center of it. That's a real, valid place to start.`;
    $('#mirror-insight-text').textContent = insight;
  }

  function deriveFallbackLeaves() {
    const wc = state.journalText.trim().split(/\s+/).filter(Boolean).length;
    if (wc > 60) return ['A lot at once', 'Little time to process'];
    return ['Still coming into focus'];
  }

  function initReflection() {
    $('#btn-to-burnkeep').addEventListener('click', () => {
      showScreen('screen-burn-keep');
    });
  }

  /* ============ Burn or Keep ============ */

  function initBurnKeep() {
    $('#btn-burn-start').addEventListener('click', () => {
      showScreen('screen-burn-countdown');
      startBurnCountdown();
    });
    $('#btn-keep-start').addEventListener('click', () => {
      persistEntry();
      showScreen('screen-keep-saved');
    });
  }

  let countdownTimer = null;
  function startBurnCountdown() {
    let n = 5;
    const numEl = $('#countdown-number');
    numEl.textContent = n;
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(countdownTimer);
        showScreen('screen-burn');
        runBurnAnimation();
        return;
      }
      numEl.textContent = n;
    }, 1000);
  }

  function initBurnCountdown() {
    $('#btn-cancel-burn').addEventListener('click', () => {
      clearInterval(countdownTimer);
      showScreen('screen-burn-keep');
    });
  }

  /* ============ Burn animation ============ */

  function buildFlames(count) {
    return Array.from({ length: count }, () => {
      const fw = (22 + Math.random() * 26).toFixed(0);
      const fh = (75 + Math.random() * 75).toFixed(0);
      const fd = (0.55 + Math.random() * 0.55).toFixed(2);
      const fdelay = (Math.random() * parseFloat(fd)).toFixed(2);
      return `<span class="flame-tongue" style="--fw:${fw}px; --fh:${fh}px; --fd:${fd}s; --fdelay:-${fdelay}s;">
        <span class="flame-outer"></span>
        <span class="flame-inner"></span>
      </span>`;
    }).join('');
  }

  function runBurnAnimation() {
    const stage = $('#burn-stage');
    const textEl = $('#burn-text');
    const flamesEl = $('#burn-flames');
    const chars = state.journalText.split('');
    const maxDelay = 1.4;

    const charSpans = chars.map(ch => {
      const delay = (Math.random() * maxDelay).toFixed(2);
      const dx = (Math.random() * 60 - 30).toFixed(0);
      const display = ch === ' ' ? '&nbsp;' : ch;
      return `<span class="burn-char" style="--d:${delay}s; --dx:${dx}">${display}</span>`;
    }).join('');

    const emberCount = Math.min(24, Math.max(10, Math.round(chars.length / 3)));
    const embers = Array.from({ length: emberCount }, () => {
      const delay = (Math.random() * maxDelay).toFixed(2);
      const x = (Math.random() * 100).toFixed(0);
      const sway = (Math.random() * 40 - 20).toFixed(0);
      return `<span class="ember-particle" style="--d:${delay}s; --x:${x}%; --sway:${sway}px"></span>`;
    }).join('');

    const totalTime = (maxDelay * 1000) + 2800 + 300;
    const flameCount = Math.min(9, Math.max(5, Math.round(chars.length / 7)));

    stage.classList.remove('is-burning');
    void stage.offsetWidth;
    stage.classList.add('is-burning');
    textEl.innerHTML = charSpans + embers;

    flamesEl.classList.remove('is-active');
    void flamesEl.offsetWidth;
    flamesEl.style.setProperty('--life', `${totalTime / 1000}s`);
    flamesEl.innerHTML = buildFlames(flameCount);
    flamesEl.classList.add('is-active');

    setTimeout(() => {
      state.journalText = '';
      showGoodbye('burned');
      showScreen('screen-goodbye');
    }, totalTime);
  }

  /* ============ Keep confirmation + privacy note + future letter ============ */

  function persistEntry() {
    const entries = loadEntries();
    entries.push({
      date: new Date().toISOString(),
      emotion: state.emotion ? state.emotion.label : null,
      heaviest: state.heaviest ? state.heaviest.label : null,
      weight: state.weight,
      text: state.journalText,
      riskFlagged: state.riskFlagged,
      tinyStep: null,
    });
    saveEntries(entries);
  }

  function initKeepSaved() {
    $('#btn-privacy-toggle').addEventListener('click', () => {
      $('#privacy-note-detail').classList.toggle('hidden');
    });

    $('#btn-future-you').addEventListener('click', () => {
      buildFutureLetter();
      showScreen('screen-future-letter');
    });

    $('#btn-skip-future').addEventListener('click', () => {
      goToTinyStep();
    });
  }

  function buildFutureLetter() {
    const emotionLabel = state.emotion ? state.emotion.label.toLowerCase() : 'heavy';
    const heaviestLabel = state.heaviest ? state.heaviest.label.toLowerCase() : 'a lot of things';

    const letter = `Hey. It's you, a little further down the road.

I remember carrying ${heaviestLabel === "i don't know" ? 'something I couldn’t quite name' : heaviestLabel}, and feeling ${emotionLabel} because of it. I know it felt like a lot right then.

I want you to know that writing it down mattered, even if nothing else changed yet. You didn't have to fix it today. You just had to notice it, and you did.

Take things one small step at a time. You're allowed to rest. You're allowed to ask for help.

I'm not a fortune teller, just you, imagining a steadier day.`;

    $('#future-letter-text').textContent = letter;
  }

  function initFutureLetter() {
    $('#btn-from-letter').addEventListener('click', goToTinyStep);
  }

  function goToTinyStep() {
    const step = TINY_STEPS[Math.floor(Math.random() * TINY_STEPS.length)];
    $('#tiny-step-text').textContent = step;
    showScreen('screen-tiny-step');
  }

  function initTinyStep() {
    $('#btn-to-hope').addEventListener('click', () => {
      const quote = HOPE_LIBRARY[Math.floor(Math.random() * HOPE_LIBRARY.length)];
      $('#hope-quote').textContent = quote;
      showScreen('screen-hope');
    });
  }

  function initHope() {
    $('#btn-to-goodbye').addEventListener('click', () => {
      showGoodbye('saved');
      showScreen('screen-goodbye');
    });
  }

  /* ============ Goodbye ============ */

  function showGoodbye(kind) {
    const eyebrow = $('#goodbye-eyebrow');
    const headline = $('#goodbye-headline');
    if (kind === 'burned') {
      eyebrow.textContent = 'you chose to let it go';
      headline.textContent = 'Some thoughts are meant to stay in the past.';
    } else if (kind === 'left') {
      eyebrow.textContent = 'take care of yourself';
      headline.textContent = "It's okay to step away.";
    } else {
      eyebrow.textContent = 'until next time';
      headline.textContent = "You've added another page to your journey.";
    }
  }

  function initGoodbye() {
    $('#btn-restart').addEventListener('click', resetJourney);
    $('#btn-goto-dashboard').addEventListener('click', () => {
      renderDashboard();
      showScreen('screen-dashboard');
    });
    $('#btn-goto-resources').addEventListener('click', () => showScreen('screen-resources'));
  }

  /* ============ Dashboard ============ */

  function renderDashboard() {
    const entries = loadEntries();
    const grid = $('#dashboard-grid');

    if (!entries.length) {
      grid.innerHTML = `
        <div class="dashboard-card span-2">
          <h3>Nothing here yet</h3>
          <p class="dashboard-empty">Your journey will start to take shape once you keep an entry. Nothing is tracked from entries you've let go.</p>
        </div>
      `;
      return;
    }

    const emotionCounts = {};
    const heaviestCounts = {};
    const weights = [];
    entries.forEach(e => {
      if (e.emotion) emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
      if (e.heaviest) heaviestCounts[e.heaviest] = (heaviestCounts[e.heaviest] || 0) + 1;
      if (typeof e.weight === 'number') weights.push(e.weight);
    });

    const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];
    const commonFeelingsHTML = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => `<li>${label}: ${count} entr${count === 1 ? 'y' : 'ies'}</li>`)
      .join('');

    const stonesHTML = Object.entries(heaviestCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => `<span class="stone">\u{1FAA8} ${label}${count > 1 ? ` (${count})` : ''}</span>`)
      .join('');

    let weightTrendHTML = '<p class="dashboard-empty">Not enough weight ratings yet to show a trend.</p>';
    if (weights.length >= 1) {
      const avg = Math.round(weights.reduce((a, b) => a + b, 0) / weights.length);
      let direction = 'holding steady';
      if (weights.length >= 2) {
        const diff = weights[weights.length - 1] - weights[0];
        if (diff <= -8) direction = 'trending lighter over time';
        else if (diff >= 8) direction = 'trending heavier lately';
      }
      weightTrendHTML = `<p>Average rated weight: <b>${avg}</b> / 100.<br>It looks like things have been ${direction}. This is a loose pattern from what you've saved, not a diagnosis.</p>`;
    }

    let timelineHTML = '<p class="dashboard-empty">Save a few more entries to see a timeline.</p>';
    if (entries.length >= 2) {
      timelineHTML = `<div class="timeline-arc">${entries.map(e => {
        const d = new Date(e.date);
        const label = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${e.emotion || '?'}`;
        return `<span class="timeline-node">${label}</span>`;
      }).join('<span>→</span>')}</div>`;
    }

    const patternNotes = [];
    if (topEmotion && topEmotion[1] >= 2) {
      patternNotes.push(`You've mentioned feeling ${topEmotion[0].toLowerCase()} in ${topEmotion[1]} entries. Worth noticing, not a guarantee of anything.`);
    }
    const topHeaviest = Object.entries(heaviestCounts).sort((a, b) => b[1] - a[1])[0];
    if (topHeaviest && topHeaviest[1] >= 2) {
      patternNotes.push(`${topHeaviest[0]} shows up as the heaviest thing more than once. This could be one thread worth paying attention to.`);
    }
    if (weights.length >= 3) {
      const recentAvg = weights.slice(-3).reduce((a, b) => a + b, 0) / 3;
      if (recentAvg < 45) patternNotes.push('Your more recent weight ratings look a bit lighter than before. That might be worth noticing.');
    }
    if (!patternNotes.length) {
      patternNotes.push("Not enough saved entries yet to notice a pattern. That's alright.");
    }
    patternNotes.push("Patterns here are built only from entries you've chosen to keep. Anything you let go isn't included.");

    const growth = weights.length
      ? entries.filter(e => typeof e.weight === 'number' && e.weight < 40).length
      : 0;

    const entriesHTML = entries.slice().reverse().map((e, i) => {
      const realIndex = entries.length - 1 - i;
      const d = new Date(e.date);
      const snippet = (e.text || '').slice(0, 60) + ((e.text || '').length > 60 ? '…' : '');
      return `
        <div class="entry-row">
          <div>
            <div class="entry-meta"><b>${e.emotion || 'Untitled'}</b> · ${d.toLocaleDateString()}</div>
            <div>${snippet || '<em>No text</em>'}</div>
          </div>
          <button class="entry-delete" data-index="${realIndex}">Delete</button>
        </div>
      `;
    }).join('');

    grid.innerHTML = `
      <div class="dashboard-card">
        <h3>Mood</h3>
        <p>${topEmotion ? `Most often, you've felt <b>${topEmotion[0]}</b>.` : 'Not enough data yet.'}</p>
      </div>
      <div class="dashboard-card">
        <h3>Emotional Weight Trend</h3>
        ${weightTrendHTML}
      </div>
      <div class="dashboard-card span-2">
        <h3>Emotional Backpack</h3>
        <div class="backpack-stones">${stonesHTML || '<p class="dashboard-empty">No stones yet.</p>'}</div>
      </div>
      <div class="dashboard-card">
        <h3>Common Feelings</h3>
        <ul>${commonFeelingsHTML}</ul>
      </div>
      <div class="dashboard-card">
        <h3>Growth Moments</h3>
        <p>${growth ? `${growth} entr${growth === 1 ? 'y felt' : 'ies felt'} noticeably lighter when rated. That's worth acknowledging.` : "No lighter moments logged yet, and that's alright."}</p>
      </div>
      <div class="dashboard-card span-2">
        <h3>Emotional Timeline</h3>
        ${timelineHTML}
      </div>
      <div class="dashboard-card span-2">
        <h3>Pattern Recognition</h3>
        <ul>${patternNotes.map(n => `<li>${n}</li>`).join('')}</ul>
      </div>
      <div class="dashboard-card span-2">
        <h3>Journal Entries</h3>
        ${entriesHTML}
      </div>
    `;

    grid.querySelectorAll('.entry-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const current = loadEntries();
        current.splice(idx, 1);
        saveEntries(current);
        renderDashboard();
      });
    });
  }

  /* ============ Reset / misc ============ */

  function resetJourney() {
    state.emotion = null;
    state.heaviest = null;
    state.journalText = '';
    state.weight = null;
    state.riskFlagged = false;
    state.promptIndex = 0;

    $('#journal-input').value = '';
    $('#word-count').textContent = '0 words';
    $('#btn-to-weight').disabled = true;
    $('#prompt-suggestion').classList.add('hidden');
    $('#weight-slider').value = 50;
    $('#weight-value').textContent = '50';
    $('#emotion-other-wrap').classList.add('hidden');
    $$('.choice-chip').forEach(c => c.classList.remove('selected'));
    $('#privacy-note-detail').classList.add('hidden');

    state.history = ['screen-landing'];
    showScreen('screen-landing', { pushHistory: false });
  }

  function initMisc() {
    $$('[data-back]').forEach(btn => {
      btn.addEventListener('click', () => goBack(btn.dataset.back));
    });
    $('#btn-home').addEventListener('click', resetJourney);

    const otherSubmit = $('#emotion-other-submit');
    const otherInput = $('#emotion-other-input');
    const submitOther = () => {
      const val = otherInput.value.trim();
      if (!val) return;
      state.emotion = { id: 'other', label: val };
      $('#heaviest-eyebrow').textContent = `you're feeling ${val.toLowerCase()}`;
      $('#emotion-other-wrap').classList.add('hidden');
      renderHeaviestGrid();
      showScreen('screen-heaviest');
    };
    otherSubmit.addEventListener('click', submitOther);
    otherInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitOther();
    });
  }

  // enter breathing transition automatically whenever that screen becomes active
  function watchTransitionScreen() {
    const target = document.getElementById('screen-transition');
    const observer = new MutationObserver(() => {
      if (target.classList.contains('active')) enterTransition();
    });
    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
  }

  /* ============ Init ============ */

  document.addEventListener('DOMContentLoaded', () => {
    initLanding();
    initTransition();
    initSafeRoom();
    initWeight();
    initSafetyPause();
    initReflection();
    initBurnKeep();
    initBurnCountdown();
    initKeepSaved();
    initFutureLetter();
    initTinyStep();
    initHope();
    initGoodbye();
    initMisc();
    watchTransitionScreen();
  });
})();
