/**
 * TARANG — Digital Magazine Viewer
 * script.js
 *
 * Responsibilities:
 *  1. Build page list from naming convention
 *  2. Inject lazy-loaded <img> elements into #magazine
 *  3. Track which page is in view via IntersectionObserver
 *  4. Update topbar counter + progress bar
 *  5. Keyboard arrow-key navigation (desktop)
 *  6. Prev/Next button navigation
 *  7. Fade-in reveal as pages enter the viewport
 */

(() => {
  'use strict';

  /* ─────────────────────────────────────────
     CONFIGURATION — adjust here if needed
  ───────────────────────────────────────── */
  const CONFIG = {
    pagesDir:   'pages/',        // folder containing images
    firstName:  'Tarang.png',    // first file (no number)
    baseName:   'Tarang',        // prefix for numbered files
    ext:        '.png',          // file extension
    totalPages: 73,              // total number of pages
    // Indices of pages visible to intersection observer
    // A page counts as "current" when ≥40% of it is in view
    observerThreshold: 0.4,
  };

  /* ─────────────────────────────────────────
     STATE
  ───────────────────────────────────────── */
  let currentPage = 1;   // 1-based
  const pageElements = [];  // array of .page-wrapper divs in order

  /* ─────────────────────────────────────────
     DOM REFERENCES
  ───────────────────────────────────────── */
  const magazine     = document.getElementById('magazine');
  const currentPageEl = document.getElementById('current-page');
  const totalPagesEl  = document.getElementById('total-pages');
  const progressBar   = document.getElementById('progress-bar');
  const btnPrev       = document.getElementById('btn-prev');
  const btnNext       = document.getElementById('btn-next');

  /* ─────────────────────────────────────────
     1. BUILD PAGE FILENAME LIST
  ───────────────────────────────────────── */
  function buildFileList() {
    const files = [];
    // First page: "Tarang.png"
    files.push(CONFIG.pagesDir + CONFIG.firstName);
    // Pages 1..N-1: "Tarang(1).png" … "Tarang(72).png"
    for (let i = 1; i < CONFIG.totalPages; i++) {
      files.push(`${CONFIG.pagesDir}${CONFIG.baseName}(${i})${CONFIG.ext}`);
    }
    return files;
  }

  /* ─────────────────────────────────────────
     2. RENDER PAGES INTO DOM
  ───────────────────────────────────────── */
  function renderPages(files) {
    totalPagesEl.textContent = files.length;

    const fragment = document.createDocumentFragment();

    files.forEach((src, idx) => {
      const pageNum = idx + 1;

      // Wrapper div — used by IntersectionObserver & animations
      const wrapper = document.createElement('div');
      wrapper.className = 'page-wrapper';
      wrapper.dataset.page = pageNum;

      // Image element with lazy loading
      const img = document.createElement('img');
      img.className   = 'page-img';
      img.alt         = `Tarang — Page ${pageNum}`;
      img.loading     = 'lazy';       // native lazy loading
      img.decoding    = 'async';      // async decode off main thread
      img.src         = src;

      // Remove shimmer when image loads
      img.addEventListener('load', () => {
        wrapper.classList.add('loaded');
      });

      // Handle broken images gracefully
      img.addEventListener('error', () => {
        wrapper.classList.add('loaded');  // remove shimmer
        img.style.display = 'none';
        wrapper.style.minHeight = '60px';
        const errNote = document.createElement('div');
        errNote.style.cssText = 'text-align:center;padding:20px;color:#444;font-size:11px;';
        errNote.textContent = `Page ${pageNum} not found`;
        wrapper.appendChild(errNote);
      });

      // Page number badge (subtle, bottom-right)
      const badge = document.createElement('span');
      badge.className   = 'page-number';
      badge.textContent = pageNum;

      wrapper.appendChild(img);
      wrapper.appendChild(badge);
      fragment.appendChild(wrapper);
      pageElements.push(wrapper);
    });

    magazine.appendChild(fragment);
  }

  /* ─────────────────────────────────────────
     3. UPDATE TOPBAR COUNTER & PROGRESS
  ───────────────────────────────────────── */
  function updateCounter(pageNum) {
    if (pageNum === currentPage) return;
    currentPage = pageNum;

    currentPageEl.textContent = pageNum;

    // Progress bar: % of pages scrolled through
    const pct = ((pageNum - 1) / (pageElements.length - 1)) * 100;
    progressBar.style.width = pct.toFixed(2) + '%';

    // Disable prev/next at boundaries
    btnPrev.disabled = pageNum <= 1;
    btnNext.disabled = pageNum >= pageElements.length;
  }

  /* ─────────────────────────────────────────
     4. INTERSECTION OBSERVER
        — track current page & trigger fade-in
  ───────────────────────────────────────── */
  function initObserver() {
    // Separate observer for current-page tracking (needs high threshold)
    const trackObserver = new IntersectionObserver((entries) => {
      let maxRatio = 0;
      let maxPage  = currentPage;

      entries.forEach(entry => {
        if (entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          maxPage  = parseInt(entry.target.dataset.page, 10);
        }
      });

      if (maxRatio > 0) {
        updateCounter(maxPage);
      }
    }, {
      // Watch a wide root margin so we always have candidates
      rootMargin: '0px',
      threshold: buildThresholds(20),  // 20 steps: 0, 0.05, 0.10 … 1.0
    });

    // Separate observer for fade-in (lower threshold so it triggers early)
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Once revealed, no need to keep watching
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -60px 0px',  // trigger a bit before fully in view
      threshold: 0.05,
    });

    pageElements.forEach(el => {
      trackObserver.observe(el);
      revealObserver.observe(el);
    });
  }

  /** Build an array of N+1 evenly-spaced thresholds from 0 to 1 */
  function buildThresholds(steps) {
    const arr = [];
    for (let i = 0; i <= steps; i++) {
      arr.push(i / steps);
    }
    return arr;
  }

  /* ─────────────────────────────────────────
     5. SCROLL HELPERS
  ───────────────────────────────────────── */
  function scrollToPage(pageNum) {
    const idx = Math.max(0, Math.min(pageNum - 1, pageElements.length - 1));
    const target = pageElements[idx];
    if (!target) return;

    // Offset for fixed topbar
    const topbarH = document.getElementById('topbar').offsetHeight;
    const top = target.getBoundingClientRect().top + window.scrollY - topbarH - 12;

    window.scrollTo({ top, behavior: 'smooth' });
  }

  /* ─────────────────────────────────────────
     6. KEYBOARD NAVIGATION (desktop)
  ───────────────────────────────────────── */
  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Only handle arrow keys; ignore if user is typing
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        scrollToPage(currentPage + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollToPage(currentPage - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        scrollToPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollToPage(pageElements.length);
      }
    });
  }

  /* ─────────────────────────────────────────
     7. BUTTON NAVIGATION
  ───────────────────────────────────────── */
  function initButtons() {
    btnPrev.addEventListener('click', () => scrollToPage(currentPage - 1));
    btnNext.addEventListener('click', () => scrollToPage(currentPage + 1));

    // Initial state
    btnPrev.disabled = true;
  }

  /* ─────────────────────────────────────────
     INIT — wire everything up
  ───────────────────────────────────────── */
  function init() {
    const files = buildFileList();
    renderPages(files);

    // Small tick so images are in the DOM before we observe
    requestAnimationFrame(() => {
      initObserver();
      initKeyboard();
      initButtons();
    });
  }

  // Kick off once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
