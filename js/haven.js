(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ============ 1. The Growing Plant SVG Generator ============ */
  function renderPlant() {
    const visits = parseInt(localStorage.getItem('sukoon_plant_visits') || '0', 10);
    const svg = $('.plant-svg');
    const desc = $('#plant-desc');
    if (!svg || !desc) return;

    // Reset plant SVG (keep pot)
    svg.innerHTML = '<path class="plant-pot" d="M35 90 L65 90 L60 115 L40 115 Z" fill="var(--rust)" />';

    if (visits <= 2) {
      // Seed stage
      svg.innerHTML += `
        <!-- Seed -->
        <circle cx="50" cy="85" r="3" fill="#8C6A3F" />
      `;
      desc.textContent = "Your seed is resting quietly in the soil. Water it or complete reflection sessions to see it grow.";
    } else if (visits <= 5) {
      // Sprout stage
      svg.innerHTML += `
        <!-- Sprout Stem -->
        <path class="plant-stem" d="M50 90 L50 72" stroke="var(--green)" stroke-width="4" stroke-linecap="round" fill="none" />
        <!-- Leaves -->
        <path class="plant-leaf" d="M50 72 Q40 65 38 68 Q42 75 50 72 Z" fill="var(--green)" />
        <path class="plant-leaf" d="M50 72 Q60 65 62 68 Q58 75 50 72 Z" fill="var(--green)" />
      `;
      desc.textContent = "A tiny green sprout has pushed through the soil. You've watered it a few times.";
    } else if (visits <= 11) {
      // Stem and leaves
      svg.innerHTML += `
        <!-- Medium Stem -->
        <path class="plant-stem" d="M50 90 Q52 75 48 55" stroke="var(--green)" stroke-width="4.5" stroke-linecap="round" fill="none" />
        <!-- Low leaves -->
        <path class="plant-leaf" d="M50 78 Q36 74 34 78 Q42 85 50 78 Z" fill="var(--green)" />
        <path class="plant-leaf" d="M49 70 Q64 66 66 70 Q58 77 49 70 Z" fill="var(--green)" />
        <!-- Top leaves -->
        <path class="plant-leaf" d="M48 55 Q38 45 35 49 Q42 58 48 55 Z" fill="var(--green)" />
        <path class="plant-leaf" d="M48 55 Q58 45 61 49 Q54 58 48 55 Z" fill="var(--green)" />
      `;
      desc.textContent = "The stem is growing taller. Leaves are starting to unfurl in the sunlight.";
    } else {
      // Tree / Mature plant
      svg.innerHTML += `
        <!-- Tree Trunk -->
        <path class="plant-stem" d="M50 90 Q53 70 48 45" stroke="var(--green)" stroke-width="6" stroke-linecap="round" fill="none" />
        <!-- Branches -->
        <path class="plant-stem" d="M50 65 Q35 55 25 58" stroke="var(--green)" stroke-width="4.5" stroke-linecap="round" fill="none" />
        <path class="plant-stem" d="M49 52 Q65 40 72 44" stroke="var(--green)" stroke-width="4.5" stroke-linecap="round" fill="none" />
        
        <!-- Leaf clusters -->
        <circle cx="25" cy="58" r="14" fill="var(--green)" opacity="0.9" />
        <circle cx="72" cy="44" r="16" fill="var(--green)" opacity="0.9" />
        <circle cx="48" cy="40" r="18" fill="var(--green)" opacity="0.95" />
        <circle cx="55" cy="30" r="12" fill="var(--green)" opacity="0.85" />
      `;
      desc.textContent = "A beautiful young tree has grown here. It stands steady in your haven, representing your quiet growth.";
    }
  }

  const waterBtn = $('#water-plant-btn');
  if (waterBtn) {
    waterBtn.addEventListener('click', () => {
      let visits = parseInt(localStorage.getItem('sukoon_plant_visits') || '0', 10);
      localStorage.setItem('sukoon_plant_visits', visits + 1);
      renderPlant();
      
      waterBtn.textContent = '💦 Watered';
      waterBtn.disabled = true;
      setTimeout(() => {
        waterBtn.textContent = '💦 Water Plant';
        waterBtn.disabled = false;
      }, 5000);
    });
  }

  /* ============ 2. Weekly Ritual ============ */
  const weeklySubmit = $('#weekly-submit');
  const weeklyInput = $('#weekly-input');
  const weeklyHistory = $('#weekly-history');

  function renderWeeklyHistory() {
    if (!weeklyHistory) return;
    const rituals = JSON.parse(localStorage.getItem('sukoon_weekly_rituals') || '[]');
    
    if (rituals.length === 0) {
      weeklyHistory.innerHTML = '<p class="fineprint" style="font-style:italic;">Your shared weekly rituals will appear here.</p>';
      return;
    }

    weeklyHistory.innerHTML = rituals.map(r => `
      <div class="card" style="background:var(--surface-soft); padding:16px; border:1px solid var(--line);">
        <div class="entry-meta">${new Date(r.date).toLocaleDateString()}</div>
        <p style="margin-top:6px; font-weight:600; color:var(--ink-soft);">"${r.text}"</p>
      </div>
    `).join('');
  }

  if (weeklySubmit && weeklyInput) {
    weeklySubmit.addEventListener('click', () => {
      const text = weeklyInput.value.trim();
      if (!text) return;

      const rituals = JSON.parse(localStorage.getItem('sukoon_weekly_rituals') || '[]');
      rituals.unshift({
        date: new Date().toISOString(),
        text: text
      });
      localStorage.setItem('sukoon_weekly_rituals', JSON.stringify(rituals));
      weeklyInput.value = '';
      renderWeeklyHistory();
      
      // Water plant
      let visits = parseInt(localStorage.getItem('sukoon_plant_visits') || '0', 10);
      localStorage.setItem('sukoon_plant_visits', visits + 1);
      renderPlant();
    });
  }

  /* ============ 3. Emotional Timeline ============ */
  function renderTimeline() {
    const listEl = $('#timeline-list');
    if (!listEl) return;

    const weatherHistory = JSON.parse(localStorage.getItem('sukoon_weather_history') || '[]');
    if (weatherHistory.length === 0) {
      listEl.innerHTML = '<p class="fineprint">No weather moments recorded yet. Complete reflection sessions in the rooms to begin your timeline.</p>';
      return;
    }

    // Sort newest first
    const sorted = [...weatherHistory].reverse();

    listEl.innerHTML = sorted.map((item, idx) => {
      const itemDate = new Date(item.date);
      const daysAgo = (new Date() - itemDate) / (1000 * 60 * 60 * 24);

      // Determine reflection text
      let reflectionTitle = "You sat in this room and held this feeling.";
      if (daysAgo >= 14) {
        reflectionTitle = "You survived this moment.";
      } else if (idx < sorted.length - 1) {
        const nextItem = sorted[idx + 1];
        if (item.weather === 'Clear Morning' && (nextItem.weather === 'Heavy Rain' || nextItem.weather === 'Storm Passing')) {
          reflectionTitle = "This was when things began changing.";
        }
      }

      // Check consecutive heavy weather
      if (item.weather === 'Heavy Rain' && idx > 0 && sorted[idx - 1].weather === 'Heavy Rain') {
        reflectionTitle = "You carried this cloud for a while.";
      }

      const weatherIcons = {
        'Heavy Rain': '🌧️',
        'Fog': '🌫️',
        'Cloudy': '☁️',
        'Gentle Breeze': '🌬️',
        'Clear Morning': '☀️'
      };

      const icon = weatherIcons[item.weather] || '🌈';

      return `
        <div class="timeline-item">
          <div>
            <div class="timeline-date">${itemDate.toLocaleString()} — in the ${item.room || 'Sanctuary'}</div>
            <div style="font-weight:600; color:var(--ink);">${reflectionTitle}</div>
          </div>
          <div class="timeline-weather-badge">
            <span>${icon}</span>
            <span>${item.weather}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ============ 4. The Early Whisper (Opt-in Analysis) ============ */
  const optinCheck = $('#whisper-optin-check');
  const whisperContent = $('#whisper-content');

  function renderEarlyWhisper() {
    if (!optinCheck || !whisperContent) return;

    const optin = localStorage.getItem('sukoon_whisper_optin') === 'true';
    optinCheck.checked = optin;

    if (!optin) {
      whisperContent.classList.add('hidden');
      return;
    }

    whisperContent.classList.remove('hidden');
    const weatherHistory = JSON.parse(localStorage.getItem('sukoon_weather_history') || '[]');

    if (weatherHistory.length < 3) {
      whisperContent.textContent = "To notice patterns, Sukoon needs a few more entries. Continue checking in when you feel ready.";
      return;
    }

    // Process weather history for patterns
    const recent = weatherHistory.slice(-5);
    const rooms = recent.map(r => r.room);
    const weathers = recent.map(r => r.weather);

    const heavyCount = weathers.filter(w => w === 'Heavy Rain' || w === 'Fog').length;
    const livingCount = rooms.filter(r => r === 'Living Room').length;
    const gardenCount = rooms.filter(r => r === 'Garden').length;

    if (heavyCount >= 3) {
      whisperContent.textContent = "This week feels heavier than the last one. Let's make sure we take things slowly.";
    } else if (livingCount >= 3) {
      whisperContent.textContent = "You've been carrying burnout worries for a while. Remember it is okay to rest.";
    } else if (gardenCount >= 3) {
      whisperContent.textContent = "Your thoughts have been moving quite fast lately. The Garden is always open to help you untangle them.";
    } else {
      whisperContent.textContent = "You have been visiting different spaces. Growth is happening, one quiet step at a time.";
    }
  }

  if (optinCheck) {
    optinCheck.addEventListener('change', () => {
      localStorage.setItem('sukoon_whisper_optin', optinCheck.checked);
      renderEarlyWhisper();
    });
  }

  /* ============ 5. The Suitcase Exporter ============ */
  function downloadSuitcase(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  const exportTxt = $('#export-suitcase-txt');
  const exportPdf = $('#export-suitcase-pdf');

  function gatherSuitcaseData() {
    const rituals = JSON.parse(localStorage.getItem('sukoon_weekly_rituals') || '[]');
    const weather = JSON.parse(localStorage.getItem('sukoon_weather_history') || '[]');
    const letters = JSON.parse(localStorage.getItem('sukoon_future_letters') || '[]');
    const plantVisits = localStorage.getItem('sukoon_plant_visits') || '0';

    return { rituals, weather, letters, plantVisits };
  }

  if (exportTxt) {
    exportTxt.addEventListener('click', () => {
      const data = gatherSuitcaseData();
      let txt = `SUKOON SANCTUARY — EXPORT FILE\n`;
      txt += `Generated on ${new Date().toLocaleString()}\n`;
      txt += `========================================\n\n`;

      txt += `PLANT GROWTH STATUS\n`;
      txt += `Total watering sessions: ${data.plantVisits}\n\n`;

      txt += `========================================\n`;
      txt += `WEEKLY RITUALS\n`;
      if (data.rituals.length === 0) {
        txt += `No weekly rituals recorded yet.\n`;
      } else {
        data.rituals.forEach(r => {
          txt += `Date: ${new Date(r.date).toLocaleString()}\n`;
          txt += `Reflected: "${r.text}"\n\n`;
        });
      }

      txt += `========================================\n`;
      txt += `EMOTIONAL WEATHER TIMELINE\n`;
      if (data.weather.length === 0) {
        txt += `No weather history logged yet.\n`;
      } else {
        data.weather.forEach(w => {
          txt += `Date: ${new Date(w.date).toLocaleString()}\n`;
          txt += `Room: ${w.room} — Mood: ${w.emotion || 'Not Specified'} — Weather: ${w.weather}\n\n`;
        });
      }

      txt += `========================================\n`;
      txt += `LETTERS TO FUTURE SELF\n`;
      if (data.letters.length === 0) {
        txt += `No future letters written yet.\n`;
      } else {
        data.letters.forEach(l => {
          const isDelivered = new Date(l.deliverAt) <= new Date();
          txt += `Written: ${new Date(l.date).toLocaleDateString()}\n`;
          txt += `Delivery Date: ${new Date(l.deliverAt).toLocaleDateString()} [Status: ${isDelivered ? 'Delivered' : 'Locked'}]\n`;
          txt += `Content: ${isDelivered ? l.text : '[LOCKED AND ENCRYPTED]'}\n\n`;
        });
      }

      downloadSuitcase('sukoon-suitcase.txt', txt, 'text/plain');
    });
  }

  if (exportPdf) {
    exportPdf.addEventListener('click', async () => {
      exportPdf.disabled = true;
      exportPdf.textContent = 'Packing Suitcase…';

      try {
        if (!window.jspdf) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const data = gatherSuitcaseData();

        let y = 20;
        doc.setFontSize(16); doc.text('Sukoon — The Suitcase Export', 14, y); y += 12;
        doc.setFontSize(11);

        doc.text(`Total plant waterings: ${data.plantVisits}`, 14, y); y += 10;

        doc.setFontSize(13); doc.text('Weekly Rituals:', 14, y); y += 8;
        doc.setFontSize(10);
        if (data.rituals.length === 0) {
          doc.text('No weekly rituals recorded.', 14, y); y += 8;
        } else {
          data.rituals.forEach(r => {
            const lines = doc.splitTextToSize(`${new Date(r.date).toLocaleDateString()}: ${r.text}`, 180);
            if (y + lines.length * 5 > 280) { doc.addPage(); y = 20; }
            doc.text(lines, 14, y);
            y += lines.length * 5 + 4;
          });
        }

        y += 6;
        doc.setFontSize(13); doc.text('Emotional Weather Timeline:', 14, y); y += 8;
        doc.setFontSize(10);
        if (data.weather.length === 0) {
          doc.text('No weather logs.', 14, y); y += 8;
        } else {
          data.weather.forEach(w => {
            const txtLine = `${new Date(w.date).toLocaleString()} | Room: ${w.room} | Weather: ${w.weather}`;
            if (y + 6 > 280) { doc.addPage(); y = 20; }
            doc.text(txtLine, 14, y);
            y += 6;
          });
        }

        y += 6;
        doc.setFontSize(13); doc.text('Future Letters Status:', 14, y); y += 8;
        doc.setFontSize(10);
        if (data.letters.length === 0) {
          doc.text('No letters created.', 14, y); y += 8;
        } else {
          data.letters.forEach(l => {
            const isDelivered = new Date(l.deliverAt) <= new Date();
            const letterText = isDelivered ? l.text : '[LOCKED AND ENCRYPTED UNTIL ARRIVAL]';
            const lines = doc.splitTextToSize(`Written on ${new Date(l.date).toLocaleDateString()} (Delivers: ${new Date(l.deliverAt).toLocaleDateString()}):\n${letterText}`, 180);
            if (y + lines.length * 5 > 280) { doc.addPage(); y = 20; }
            doc.text(lines, 14, y);
            y += lines.length * 5 + 6;
          });
        }

        doc.save('sukoon-suitcase.pdf');
      } catch (e) {
        console.error(e);
      } finally {
        exportPdf.disabled = false;
        exportPdf.textContent = 'Export as PDF';
      }
    });
  }

  /* ============ 6. The Finite Library Rendering ============ */
  function renderLibrary() {
    const grid = $('#library-grid');
    if (!grid || !window.SUKOON_LIBRARY) return;

    const data = window.SUKOON_LIBRARY;

    grid.innerHTML = Object.keys(data).map(key => {
      const cat = data[key];
      const articlesHtml = cat.articles.map(art => `
        <li>
          <a href="${art.url}" target="_blank" rel="noopener">${art.title}</a>
        </li>
      `).join('');

      const booksHtml = cat.books.map(bk => `
        <li>
          <span>${bk.title}</span>
          <span class="book-author">by ${bk.author}</span>
        </li>
      `).join('');

      return `
        <div class="library-category-card">
          <h3 class="display-sm" style="font-size:1.15rem; display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <span>${cat.emoji}</span><span>${cat.title}</span>
          </h3>
          <p class="eyebrow" style="font-size:0.65rem; margin-bottom:6px; color:var(--teal);">Articles</p>
          <ul class="library-item-list">
            ${articlesHtml}
          </ul>
          <p class="eyebrow" style="font-size:0.65rem; margin-top:16px; margin-bottom:6px; color:var(--teal);">Books</p>
          <ul class="library-item-list">
            ${booksHtml}
          </ul>
        </div>
      `;
    }).join('');
  }

  /* ============ Page Init ============ */
  document.addEventListener('DOMContentLoaded', () => {
    renderPlant();
    renderWeeklyHistory();
    renderTimeline();
    renderEarlyWhisper();
    renderLibrary();
  });
})();
