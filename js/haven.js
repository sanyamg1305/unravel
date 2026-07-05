(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);

  /* ============ Finite Library Rendering ============ */
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
        <div class="library-category-card" style="margin-bottom: 24px; text-align: left;">
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

  document.addEventListener('DOMContentLoaded', () => {
    renderLibrary();
  });
})();
