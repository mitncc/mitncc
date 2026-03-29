/**
 * TARANG — Digital Magazine Viewer
 * script.js
 *
 * DESKTOP : scrollable page-by-page view, keyboard nav, IntersectionObserver
 * MOBILE  : fullscreen single-page viewer, swipe left/right, tap zones, sound
 */

(() => {
  'use strict';

  /* ─────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────── */
  const CONFIG = {
    pagesDir:    'pages/',   // folder with images
    totalPages:  85,         // 1.png … 85.png
    isMobile:    () => window.innerWidth < 768,
  };

  /* ─────────────────────────────────────────
     BUILD FILE LIST  →  ["pages/1.png", "pages/2.png", …]
  ───────────────────────────────────────── */
  function buildFileList() {
    const files = [];
    for (let i = 1; i <= CONFIG.totalPages; i++) {
      files.push(`${CONFIG.pagesDir}${i}.png`);
    }
    return files;
  }

  const FILES = buildFileList();
  const TOTAL = FILES.length;

  /* ─────────────────────────────────────────
     DOM REFS
  ───────────────────────────────────────── */
  // Desktop
  const magazine      = document.getElementById('magazine');
  const currentPageEl = document.getElementById('current-page');
  const totalPagesEl  = document.getElementById('total-pages');
  const progressBar   = document.getElementById('progress-bar');
  const btnPrev       = document.getElementById('btn-prev');
  const btnNext       = document.getElementById('btn-next');

  // Mobile
  const mobileViewer  = document.getElementById('mobile-viewer');
  const mobileImg     = document.getElementById('mobile-img');
  const mCurrentEl    = document.getElementById('m-current');
  const mTotalEl      = document.getElementById('m-total');
  const tapPrev       = document.getElementById('tap-prev');
  const tapNext       = document.getElementById('tap-next');

  // Sound
  const sound         = document.getElementById('page-turn-sound');

  /* ─────────────────────────────────────────
     SHARED STATE
  ───────────────────────────────────────── */
  let currentPage = 1;          // 1-based, shared between both modes
  const pageElements = [];      // desktop .page-wrapper divs

  /* ─────────────────────────────────────────
     SOUND — play page-turn mp3
     (must be triggered by user gesture on iOS)
  ───────────────────────────────────────── */
  function playTurnSound() {
    if (!sound) return;
    try {
      sound.currentTime = 0;
      const p = sound.play();
      if (p && p.catch) p.catch(() => {}); // silence NotAllowedError
    } catch (_) {}
  }

  /* ─────────────────────────────────────────
     ══════════════════════════════════════
         DESKTOP MODE
     ══════════════════════════════════════
  ───────────────────────────────────────── */

  function initDesktop() {
    totalPagesEl.textContent = TOTAL;
    btnPrev.disabled = true;

    // Render all page wrappers
    const frag = document.createDocumentFragment();
    FILES.forEach((src, idx) => {
      const pageNum = idx + 1;
      const wrapper = document.createElement('div');
      wrapper.className = 'page-wrapper';
      wrapper.dataset.page = pageNum;

      const img = document.createElement('img');
      img.className = 'page-img';
      img.alt       = `Tarang — Page ${pageNum}`;
      img.loading   = 'lazy';
      img.decoding  = 'async';
      img.src       = src;
      img.addEventListener('load',  () => wrapper.classList.add('loaded'));
      img.addEventListener('error', () => {
        wrapper.classList.add('loaded');
        img.style.display = 'none';
        const note = document.createElement('div');
        note.style.cssText = 'text-align:center;padding:20px;color:#444;font-size:11px;';
        note.textContent = `Page ${pageNum} not found`;
        wrapper.appendChild(note);
      });

      const badge = document.createElement('span');
      badge.className   = 'page-number';
      badge.textContent = pageNum;

      wrapper.appendChild(img);
      wrapper.appendChild(badge);
      frag.appendChild(wrapper);
      pageElements.push(wrapper);
    });
    magazine.appendChild(frag);

    // Observers
    initDesktopObserver();
    initRevealObserver();

    // Keyboard
    document.addEventListener('keydown', onKeyDown);

    // Buttons
    btnPrev.addEventListener('click', () => desktopScrollTo(currentPage - 1));
    btnNext.addEventListener('click', () => desktopScrollTo(currentPage + 1));
  }

  function updateDesktopCounter(pageNum) {
    if (pageNum === currentPage && currentPageEl.textContent === String(pageNum)) return;
    currentPage = pageNum;
    currentPageEl.textContent = pageNum;
    const pct = ((pageNum - 1) / (TOTAL - 1)) * 100;
    progressBar.style.width = pct.toFixed(2) + '%';
    btnPrev.disabled = pageNum <= 1;
    btnNext.disabled = pageNum >= TOTAL;
  }

  function initDesktopObserver() {
    const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);
    const obs = new IntersectionObserver(entries => {
      let maxRatio = 0, maxPage = currentPage;
      entries.forEach(e => {
        if (e.intersectionRatio > maxRatio) {
          maxRatio = e.intersectionRatio;
          maxPage  = parseInt(e.target.dataset.page, 10);
        }
      });
      if (maxRatio > 0) updateDesktopCounter(maxPage);
    }, { threshold: thresholds });

    pageElements.forEach(el => obs.observe(el));
  }

  function initRevealObserver() {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0.05 });

    pageElements.forEach(el => obs.observe(el));
  }

  function desktopScrollTo(pageNum) {
    const idx = Math.max(0, Math.min(pageNum - 1, pageElements.length - 1));
    const target = pageElements[idx];
    if (!target) return;
    const topbarH = document.getElementById('topbar').offsetHeight;
    const top = target.getBoundingClientRect().top + window.scrollY - topbarH - 12;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  function onKeyDown(e) {
    if (!CONFIG.isMobile()) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault(); desktopScrollTo(currentPage + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault(); desktopScrollTo(currentPage - 1);
      } else if (e.key === 'Home') {
        e.preventDefault(); desktopScrollTo(1);
      } else if (e.key === 'End') {
        e.preventDefault(); desktopScrollTo(TOTAL);
      }
    }
  }


  /* ─────────────────────────────────────────
     ══════════════════════════════════════
         MOBILE FULLSCREEN MODE
     ══════════════════════════════════════
  ───────────────────────────────────────── */

  let mobileInTransition = false;

  function initMobile() {
    mTotalEl.textContent = TOTAL;
    showMobilePage(currentPage, 'none');

    // Tap zones
    tapPrev.addEventListener('click', () => mobileGo(currentPage - 1, 'right'));
    tapNext.addEventListener('click', () => mobileGo(currentPage + 1, 'left'));

    // Swipe detection
    initSwipe();
  }

  /**
   * Show a page on mobile.
   * direction: 'left' | 'right' | 'none'
   *   'left'  = swiping left  → next page (image exits left, new comes from right)
   *   'right' = swiping right → prev page (image exits right, new comes from left)
   */
  function showMobilePage(pageNum, direction) {
    if (mobileInTransition) return;
    pageNum = Math.max(1, Math.min(pageNum, TOTAL));
    if (pageNum === currentPage && mobileImg.src.endsWith(`${pageNum}.png`)) return;

    mobileInTransition = true;

    const src = FILES[pageNum - 1];

    if (direction === 'none') {
      // Initial load — no animation
      mobileImg.src = src;
      currentPage = pageNum;
      updateMobileCounter(pageNum);
      mobileInTransition = false;
      return;
    }

    // Animate out
    const outClass = direction === 'left' ? 'flip-out-left' : 'flip-out-right';
    mobileImg.classList.add(outClass);

    setTimeout(() => {
      // Swap image
      mobileImg.classList.remove(outClass);
      mobileImg.classList.add('flip-in');
      mobileImg.src = src;

      // Play sound
      playTurnSound();

      // Update state
      currentPage = pageNum;
      updateMobileCounter(pageNum);

      // Fade in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          mobileImg.classList.remove('flip-in');
          mobileInTransition = false;
        });
      });
    }, 180); // matches CSS transition duration
  }

  function mobileGo(pageNum, direction) {
    pageNum = Math.max(1, Math.min(pageNum, TOTAL));
    if (pageNum === currentPage) return;
    showMobilePage(pageNum, direction);
  }

  function updateMobileCounter(pageNum) {
    mCurrentEl.textContent = pageNum;
  }

  /* ── Swipe detection ── */
  function initSwipe() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    const SWIPE_THRESHOLD  = 40;   // min px horizontal to count as swipe
    const ANGLE_THRESHOLD  = 40;   // max degrees from horizontal

    mobileViewer.addEventListener('touchstart', e => {
      const t = e.touches[0];
      touchStartX    = t.clientX;
      touchStartY    = t.clientY;
      touchStartTime = Date.now();
    }, { passive: true });

    mobileViewer.addEventListener('touchend', e => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const dt = Date.now() - touchStartTime;

      // Ignore long-press, near-vertical swipes
      if (dt > 600) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
      if (angle > ANGLE_THRESHOLD && angle < (180 - ANGLE_THRESHOLD)) return;

      if (dx < 0) {
        // Swipe left → next page
        mobileGo(currentPage + 1, 'left');
      } else {
        // Swipe right → prev page
        mobileGo(currentPage - 1, 'right');
      }
    }, { passive: true });
  }


  /* ─────────────────────────────────────────
     INIT — decide mode and boot
  ───────────────────────────────────────── */
  function init() {
    // Always init desktop DOM (even on mobile breakpoint,
    // in case user rotates to landscape / resizes)
    if (!CONFIG.isMobile()) {
      initDesktop();
    }

    // Mobile viewer is always initialised — CSS hides/shows the correct one
    initMobile();

    // If window resizes across the breakpoint, reload to re-init cleanly
    let wasAlreadyMobile = CONFIG.isMobile();
    window.addEventListener('resize', () => {
      const isMobileNow = CONFIG.isMobile();
      if (isMobileNow !== wasAlreadyMobile) {
        wasAlreadyMobile = isMobileNow;
        // Re-init the newly visible mode if needed
        if (!isMobileNow && pageElements.length === 0) {
          initDesktop();
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
