/**
 * TARANG — Page-Flip Magazine Viewer
 * script.js
 *
 * Architecture:
 *   - The "book" shows two static pages (left + right) at all times.
 *   - A "flipper" div sits on top, containing front/back faces.
 *   - When turning, we:
 *       1. Pre-load images into flipper faces BEFORE animation starts
 *       2. Animate immediately (zero delay)
 *       3. On animation end, update static pages and reset flipper
 *
 * Desktop: double-page spread (pages 1+2, 3+4, …)
 * Mobile:  single page at a time
 *
 * Page numbering: 1-based. Files: pages/1.png … pages/85.png
 */

(() => {
  'use strict';

  /* ── CONFIG ── */
  const TOTAL     = 85;
  const DIR       = 'pages/';
  const FLIP_MS   = 450;          // must match CSS --flip-dur
  const IS_MOBILE = () => window.innerWidth <= 700;

  /* ── PRELOAD CACHE ── */
  // Preload N pages ahead so flips feel instant
  const PRELOAD_AHEAD = 4;
  const cache = {};   // src → Image object

  function preload(pageNum) {
    if (pageNum < 1 || pageNum > TOTAL) return;
    const src = `${DIR}${pageNum}.png`;
    if (cache[src]) return;
    const img = new Image();
    img.src = src;
    cache[src] = img;
  }

  function src(n) {
    return (n >= 1 && n <= TOTAL) ? `${DIR}${n}.png` : '';
  }

  /* ── STATE ── */
  // On desktop, spread = which LEFT page is showing (always odd if 1-indexed from left, but we use spread index)
  // spreadBase: the left page number of the current spread.
  // Desktop spreads: [1,2], [3,4], [5,6] … so spreadBase = 1, 3, 5, …
  // Mobile: single page, spreadBase = current page number
  let spreadBase   = 1;     // left page of current spread (or current page on mobile)
  let isAnimating  = false;

  /* ── DOM ── */
  const book         = document.getElementById('book');
  const leftPage     = document.getElementById('left-page');
  const rightPage    = document.getElementById('right-page');
  const leftImg      = document.getElementById('left-img');
  const rightImg     = document.getElementById('right-img');
  const flipper      = document.getElementById('flipper');
  const flipFrontImg = document.getElementById('flip-front-img');
  const flipBackImg  = document.getElementById('flip-back-img');
  const curPageEl    = document.getElementById('cur-page');
  const totPageEl    = document.getElementById('tot-page');
  const progEl       = document.getElementById('prog');
  const btnPrev      = document.getElementById('btn-prev');
  const btnNext      = document.getElementById('btn-next');
  const arrPrev      = document.getElementById('arr-prev');
  const arrNext      = document.getElementById('arr-next');
  const snd          = document.getElementById('snd');

  /* ── SIZE THE BOOK to fit viewport ── */
  function sizeBook() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tbH = document.getElementById('topbar').offsetHeight;
    const availH = vh - tbH - (IS_MOBILE() ? 32 : 48);
    const availW = vw - (IS_MOBILE() ? 96 : 120);

    // Each page has a natural portrait ratio ~0.72 (w/h). Adjust if yours differ.
    const PAGE_RATIO = 0.72;

    if (IS_MOBILE()) {
      // Single page
      let pw = availW;
      let ph = pw / PAGE_RATIO;
      if (ph > availH) { ph = availH; pw = ph * PAGE_RATIO; }
      book.style.width  = pw + 'px';
      book.style.height = ph + 'px';
    } else {
      // Double page spread
      let bw = availW;
      let bh = bw / 2 / PAGE_RATIO;  // half the book width per page
      if (bh > availH) { bh = availH; bw = bh * PAGE_RATIO * 2; }
      book.style.width  = bw + 'px';
      book.style.height = bh + 'px';
    }
  }

  /* ── COUNTER + PROGRESS ── */
  function updateUI() {
    const displayPage = IS_MOBILE() ? spreadBase : spreadBase;
    curPageEl.textContent = displayPage;
    const pct = ((displayPage - 1) / (TOTAL - 1)) * 100;
    progEl.style.width = Math.min(100, pct).toFixed(1) + '%';

    const atStart = spreadBase <= 1;
    const atEnd   = IS_MOBILE() ? spreadBase >= TOTAL : spreadBase + 1 >= TOTAL;
    btnPrev.disabled = atStart;
    arrPrev.disabled = atStart;
    btnNext.disabled = atEnd;
    arrNext.disabled = atEnd;
  }

  /* ── RENDER static pages (no animation) ── */
  function renderStatic(base) {
    if (IS_MOBILE()) {
      leftImg.src = src(base);
      rightImg.src = '';
    } else {
      leftImg.src  = src(base);
      rightImg.src = src(base + 1);
    }
  }

  /* ── PLAY SOUND ── */
  function playSound() {
    if (!snd) return;
    try {
      snd.currentTime = 0;
      const p = snd.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }

  /* ── FLIP ANIMATION ──────────────────────────────────────────────────
   *
   * FORWARD (next): right half of book folds back → reveals next spread
   *   - flipper positioned on the RIGHT half
   *   - front face = current right page (what's showing)
   *   - back  face = next left page (what will be revealed)
   *   - book's right static page switches to next right page instantly
   *   - animates: rotateY(0) → rotateY(-180deg)
   *
   * BACKWARD (prev): left half of book folds back → reveals prev spread
   *   - flipper positioned on the LEFT half
   *   - front face (seen from back) = current left page
   *   - back  face = prev right page
   *   - book's left static page switches to prev left page instantly
   *   - animates: rotateY(-180deg) → rotateY(0)
   *
   * Mobile: same but only one page, flipper = full width
   * ────────────────────────────────────────────────────────────────── */

  function flip(direction) {
    if (isAnimating) return;

    const mobile = IS_MOBILE();
    const step   = mobile ? 1 : 2;

    // Compute next spreadBase
    let nextBase;
    if (direction === 'forward') {
      nextBase = spreadBase + step;
      if (nextBase > TOTAL) return;
    } else {
      nextBase = spreadBase - step;
      if (nextBase < 1) return;
    }

    isAnimating = true;
    playSound();

    // ── Set up flipper faces ──
    if (mobile) {
      // Full width flipper
      flipper.style.left  = '0';
      flipper.style.right = '0';
      flipper.style.width = '100%';
      if (direction === 'forward') {
        flipper.style.transformOrigin = 'left center';
        flipFrontImg.src = src(spreadBase);       // current page
        flipBackImg.src  = src(nextBase);         // next page
        // Under the flipper: show next page on left static immediately
        leftImg.src = src(nextBase);
        flipper.style.transform = 'rotateY(0deg)';
      } else {
        flipper.style.transformOrigin = 'right center';
        flipFrontImg.src = src(nextBase);         // prev page (shown as back)
        flipBackImg.src  = src(spreadBase);       // current page (front = back face)
        leftImg.src = src(nextBase);
        flipper.style.transform = 'rotateY(-180deg)';
      }
    } else {
      // Desktop double spread
      if (direction === 'forward') {
        // Flipper on right half
        flipper.style.left  = '50%';
        flipper.style.right = '0';
        flipper.style.width = '50%';
        flipper.style.transformOrigin = 'left center';
        flipFrontImg.src = src(spreadBase + 1);   // current right page
        flipBackImg.src  = src(nextBase);         // next left page
        // Swap right static to next right page (hidden under flipper initially, reveals at end)
        rightImg.src = src(nextBase + 1);
        flipper.style.transform = 'rotateY(0deg)';
      } else {
        // Flipper on left half
        flipper.style.left  = '0';
        flipper.style.right = '50%';
        flipper.style.width = '50%';
        flipper.style.transformOrigin = 'right center';
        flipFrontImg.src = src(nextBase + 1);     // prev right page (shown as back)
        flipBackImg.src  = src(spreadBase);       // current left page
        leftImg.src = src(nextBase);
        flipper.style.transform = 'rotateY(-180deg)';
      }
    }

    // Force reflow so transform is applied before animation starts
    void flipper.offsetWidth;

    // ── Trigger CSS animation ──
    flipper.classList.add(direction === 'forward' ? 'flip-forward' : 'flip-backward');

    // ── On animation end ──
    flipper.addEventListener('animationend', function done() {
      flipper.removeEventListener('animationend', done);
      flipper.classList.remove('flip-forward', 'flip-backward');

      // Commit new state
      spreadBase = nextBase;
      renderStatic(spreadBase);

      // Hide flipper (push off screen)
      flipper.style.transform = 'rotateY(90deg)'; // invisible, won't show
      // Actually just move it out of sight
      flipper.style.left = '-200%';

      updateUI();
      isAnimating = false;

      // Preload upcoming pages
      preloadAhead();
    }, { once: true });
  }

  function preloadAhead() {
    const mobile = IS_MOBILE();
    const step = mobile ? 1 : 2;
    for (let i = 1; i <= PRELOAD_AHEAD; i++) {
      preload(spreadBase + i * step);
      preload(spreadBase - i * step);
    }
  }

  /* ── INITIAL RENDER ── */
  function init() {
    totPageEl.textContent = TOTAL;
    sizeBook();
    renderStatic(spreadBase);
    updateUI();
    preloadAhead();

    // Hide flipper initially
    flipper.style.left = '-200%';

    // Buttons
    btnNext.addEventListener('click', () => flip('forward'));
    btnPrev.addEventListener('click', () => flip('backward'));
    arrNext.addEventListener('click', () => flip('forward'));
    arrPrev.addEventListener('click', () => flip('backward'));

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); flip('forward'); }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp'  ) { e.preventDefault(); flip('backward'); }
    });

    // Touch / swipe
    let tx0 = 0, ty0 = 0, t0 = 0;
    document.addEventListener('touchstart', e => {
      tx0 = e.touches[0].clientX;
      ty0 = e.touches[0].clientY;
      t0  = Date.now();
    }, { passive: true });
    document.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx0;
      const dy = e.changedTouches[0].clientY - ty0;
      const dt = Date.now() - t0;
      if (dt > 500 || Math.abs(dx) < 35) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.2) return;
      if (dx < 0) flip('forward');
      else        flip('backward');
    }, { passive: true });

    // Resize
    window.addEventListener('resize', () => {
      sizeBook();
      renderStatic(spreadBase);
      updateUI();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
