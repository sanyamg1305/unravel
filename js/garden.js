(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);

  /* ============ 60-Second Reset (4-7-8 breathing) ============ */
  function initResetCircle() {
    const word = $('#reset-word');
    const pulse = $('.pulse');
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

  document.addEventListener('DOMContentLoaded', () => {
    initResetCircle();
  });
})();
