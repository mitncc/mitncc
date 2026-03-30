/**
 * TARANG — Page-Flip Magazine Viewer  |  script.js
 *
 * LAYOUT
 * ──────
 * Mobile  (≤700px): single page, fills entire screen below topbar.
 * Desktop (>700px): double-page spread.
 *   • Spread 0  → cover page 1 alone (left=blank, right=page1)
 *   • Spread 1  → pages 2 + 3   (left=2, right=3)
 *   • Spread 2  → pages 4 + 5   (left=4, right=5)
 *   • …
 *   • spreadIndex s → leftPage = s*2, rightPage = s*2+1
 *     (0 is special: leftPage=0=blank, rightPage=1)
 *
 * FLIP LOGIC (desktop)
 * ─────────────────────
 * Forward (cover → spread1):
 *   Flipper on RIGHT half. front=page1, back=page2.
 *   Behind: left=page2 already swapped, right=page3.
 *   Rotate: 0 → -180.
 *
 * Forward (spread N → spread N+1):
 *   Flipper on RIGHT half. front=rightPage, back=nextLeftPage.
 *   Behind: left=nextLeftPage, right=nextRightPage.
 *   Rotate: 0 → -180.
 *
 * Backward (spread1 → cover):
 *   Flipper on LEFT half. front=page2 (shown as back), back=page1 (shown as front after rotate).
 *   Wait — for backward we want the LEFT half to fold OPEN to the right.
 *   Flipper origin = right edge. front=page2, back=page1.
 *   Start at rotateY(0), animate to rotateY(+180). As it rotates right,
 *   the front (page2) peels away revealing back (page1) = cover.
 *   Behind: right=page1 (cover), left=blank.
 *
 * Backward (spread N → spread N-1):
 *   Flipper on LEFT half. front=leftPage, back=prevRightPage.
 *   Rotate: 0 → +180.
 *   Behind: right=prevRightPage, left=prevLeftPage.
 *
 * NO animationend reliance — we use setTimeout(FLIP_MS) to commit state.
 * This eliminates the desktop lag where animationend misfires.
 */

(() => {
  'use strict';

  /* ── CONFIG ── */
  const TOTAL         = 85;
  const DIR           = 'pages/';
  const FLIP_MS       = 420;        // must match CSS --flip-dur (0.42s)
  const PRELOAD_AHEAD = 4;
  const MOBILE_BP     = 700;

  const isMobile = () => window.innerWidth <= MOBILE_BP;

  /* ── PAGE HELPERS ── */
  // spreadIndex → { left, right } page numbers (0 = blank)
  function spreadPages(si) {
    if (si === 0) return { left: 0, right: 1 };          // cover
    return { left: si * 2, right: si * 2 + 1 };
  }
  // total number of spreads on desktop
  // spread 0 = cover, then pairs: ceil((85-1)/2) = 42 more → 43 spreads (0..42)
  const TOTAL_SPREADS = 1 + Math.ceil((TOTAL - 1) / 2);  // = 43

  function src(n) {
    return (n >= 1 && n <= TOTAL) ? `${DIR}${n}.png` : '';
  }

  /* ── PRELOAD ── */
  const cache = {};
  function preload(n) {
    if (n < 1 || n > TOTAL || cache[n]) return;
    const img = new Image();
    img.src = src(n);
    cache[n] = img;
  }
  function preloadAround(si) {
    for (let d = 1; d <= PRELOAD_AHEAD; d++) {
      const { left: l1, right: r1 } = spreadPages(Math.min(si + d, TOTAL_SPREADS - 1));
      const { left: l2, right: r2 } = spreadPages(Math.max(si - d, 0));
      preload(l1); preload(r1); preload(l2); preload(r2);
    }
  }

  /* ── STATE ── */
  let spreadIndex  = 0;     // desktop: current spread (0 = cover)
  let mobilePage   = 1;     // mobile: current page
  let isAnimating  = false;

  /* ── DOM ── */
  const topbar       = document.getElementById('topbar');
  const book         = document.getElementById('book');
  const leftPage     = document.getElementById('left-page');
  const rightPage    = document.getElementById('right-page');
  const leftImg      = document.getElementById('left-img');
  const rightImg     = document.getElementById('right-img');
  const spine        = document.getElementById('spine');
  const flipper      = document.getElementById('flipper');
  const flipFront    = document.getElementById('flip-front-img');
  const flipBack     = document.getElementById('flip-back-img');
  const curPageEl    = document.getElementById('cur-page');
  const totPageEl    = document.getElementById('tot-page');
  const progEl       = document.getElementById('prog');
  const btnPrev      = document.getElementById('btn-prev');
  const btnNext      = document.getElementById('btn-next');
  const arrPrev      = document.getElementById('arr-prev');
  const arrNext      = document.getElementById('arr-next');
  const snd          = document.getElementById('snd');

  /* ── SIZE BOOK ── */
  function sizeBook() {
    const tbH = topbar.offsetHeight;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const availH = vh - tbH;

    if (isMobile()) {
      // Single page, full bleed
      book.style.width  = vw + 'px';
      book.style.height = availH + 'px';
      leftPage.style.flex  = '1 1 100%';
      rightPage.style.display = 'none';
      spine.style.display = 'none';
    } else {
      // Double page: fit both pages side by side, constrained to viewport
      // Each page is portrait ~0.71 aspect (adjust if your pages differ)
      const PAGE_W_H = 0.71;
      const maxW = vw - 80;       // leave room for side arrows
      const maxH = availH - 32;   // small vertical breathing room

      let bw = maxW;
      let bh = bw / 2 / PAGE_W_H;
      if (bh > maxH) { bh = maxH; bw = bh * PAGE_W_H * 2; }

      book.style.width  = bw + 'px';
      book.style.height = bh + 'px';
      leftPage.style.flex  = '1 1 50%';
      rightPage.style.display = 'block';
      spine.style.display = 'block';
    }

    // Flipper: set its height to match book; width set per-flip
    flipper.style.height = book.style.height;
  }

  /* ── RENDER STATIC (no animation) ── */
  function renderStatic() {
    if (isMobile()) {
      leftImg.src  = src(mobilePage);
      rightImg.src = '';
    } else {
      const { left, right } = spreadPages(spreadIndex);
      leftImg.src  = src(left);   // src(0) = '' → blank
      rightImg.src = src(right);
    }
  }

  /* ── UI ── */
  function updateUI() {
    const displayPage = isMobile() ? mobilePage : spreadPages(spreadIndex).right || spreadPages(spreadIndex).left;
    curPageEl.textContent = displayPage;
    const pct = ((displayPage - 1) / (TOTAL - 1)) * 100;
    progEl.style.width = Math.min(100, Math.max(0, pct)).toFixed(1) + '%';

    if (isMobile()) {
      btnPrev.disabled = arrPrev.disabled = mobilePage <= 1;
      btnNext.disabled = arrNext.disabled = mobilePage >= TOTAL;
    } else {
      btnPrev.disabled = arrPrev.disabled = spreadIndex <= 0;
      btnNext.disabled = arrNext.disabled = spreadIndex >= TOTAL_SPREADS - 1;
    }
  }

  /* ── SOUND ── */
  let muted = false;
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked || !snd) return;
    audioUnlocked = true;
    snd.play().then(() => { snd.pause(); snd.currentTime = 0; }).catch(() => {});
  }
  document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  document.addEventListener('mousedown',  unlockAudio, { once: true });

  function playSound() {
    if (!snd || muted) return;
    try { snd.currentTime = 0; snd.play().catch(() => {}); } catch (_) {}
  }

  /* ══════════════════════════════════════════════════════
     FLIP — the core animation function

     direction: 'forward' | 'backward'

     Steps:
       1. Compute next spread/page
       2. Set up flipper (position, faces, transform-origin, start-transform)
       3. Pre-update static pages (they hide under the flipper during animation)
       4. Force reflow
       5. Add animation class  ← animation starts IMMEDIATELY, zero delay
       6. setTimeout(FLIP_MS) → commit state, park flipper, re-render

     Why setTimeout instead of animationend:
       animationend is unreliable — if the element is repositioned or the
       class is toggled before the browser fires the event, it silently drops
       the event, causing the "stuck page" bug on desktop.
       setTimeout with the exact same duration is 100% reliable.
  ══════════════════════════════════════════════════════ */
  function flip(direction) {
    if (isAnimating) return;

    if (isMobile()) {
      flipMobile(direction);
    } else {
      flipDesktop(direction);
    }
  }

  /* ── MOBILE FLIP (single page, full width) ── */
  function flipMobile(direction) {
    const nextPage = direction === 'forward' ? mobilePage + 1 : mobilePage - 1;
    if (nextPage < 1 || nextPage > TOTAL) return;

    isAnimating = true;
    playSound();

    const bw = parseInt(book.style.width);
    const bh = parseInt(book.style.height);

    // Flipper = full book width
    flipper.style.width  = bw + 'px';
    flipper.style.height = bh + 'px';
    flipper.style.top    = '0';

    if (direction === 'forward') {
      flipper.style.left            = '0';
      flipper.style.transformOrigin = 'left center';
      flipFront.src = src(mobilePage);
      flipBack.src  = src(nextPage);
      // Pre-update static (hidden behind flipper)
      leftImg.src = src(nextPage);
      flipper.style.transform = 'rotateY(0deg)';
    } else {
      flipper.style.left            = '0';
      flipper.style.transformOrigin = 'right center';
      flipFront.src = src(nextPage);
      flipBack.src  = src(mobilePage);
      leftImg.src   = src(nextPage);
      flipper.style.transform = 'rotateY(0deg)';
    }

    void flipper.offsetWidth; // reflow

    const cls = direction === 'forward' ? 'anim-forward' : 'anim-backward';
    flipper.classList.add(cls);

    setTimeout(() => {
      flipper.classList.remove(cls);
      flipper.style.left = '-400%';
      mobilePage = nextPage;
      renderStatic();
      updateUI();
      isAnimating = false;
      for (let i = 1; i <= PRELOAD_AHEAD; i++) {
        preload(mobilePage + i);
        preload(mobilePage - i);
      }
    }, FLIP_MS);
  }

  /* ── DESKTOP FLIP (double page spread) ── */
  function flipDesktop(direction) {
    const nextSI = direction === 'forward' ? spreadIndex + 1 : spreadIndex - 1;
    if (nextSI < 0 || nextSI >= TOTAL_SPREADS) return;

    isAnimating = true;
    playSound();

    const bw = parseFloat(book.style.width);
    const bh = parseFloat(book.style.height);
    const hw = bw / 2;   // half width

    const cur  = spreadPages(spreadIndex);
    const next = spreadPages(nextSI);

    if (direction === 'forward') {
      /*
       * Right half peels toward the left.
       * Flipper sits on the RIGHT half.
       * Front face = current right page.
       * Back  face = next left page.
       * Behind right: pre-load next right page (revealed when flipper finishes).
       * Behind left:  pre-load next left page (hidden by flipper during anim, not visible until end).
       *
       * Wait — actually: the flipper covers the right half during the whole animation.
       * When it's at 0°, we see the front (cur.right).
       * When it's at -180°, we see the back (next.left) — but it's now on the LEFT side.
       * So the left static page must show next.left (hidden under flipper start, revealed at end from left).
       * The right static page must show next.right (revealed when flipper departs the right at end).
       */
      flipper.style.left   = hw + 'px';
      flipper.style.width  = hw + 'px';
      flipper.style.height = bh + 'px';
      flipper.style.top    = '0';
      flipper.style.transformOrigin = 'left center';
      flipper.style.transform = 'rotateY(0deg)';

      flipFront.src = src(cur.right);   // what user sees now on the right
      flipBack.src  = src(next.left);   // what's revealed on left as page folds over

      // Pre-update static pages (both hidden under or behind flipper)
      leftImg.src  = src(next.left);    // will be exposed when flipper crosses to left
      rightImg.src = src(next.right);   // exposed when flipper leaves the right

    } else {
      /*
       * Left half peels toward the right.
       * Flipper sits on the LEFT half.
       * Front face = current left page (what's showing on left now).
       * Back  face = prev right page (what's revealed on the right as left peels away).
       * Rotate: 0 → +180 (anim-backward).
       *
       * Behind: left static = prev left page, right static = prev right page.
       */
      flipper.style.left   = '0';
      flipper.style.width  = hw + 'px';
      flipper.style.height = bh + 'px';
      flipper.style.top    = '0';
      flipper.style.transformOrigin = 'right center';
      flipper.style.transform = 'rotateY(0deg)';

      flipFront.src = src(cur.left);    // current left page
      flipBack.src  = src(next.right);  // prev spread's right page (revealed)

      // Pre-update static pages
      leftImg.src  = src(next.left);    // prev left (0 = blank for cover)
      rightImg.src = src(next.right);   // prev right
    }

    void flipper.offsetWidth; // force reflow — critical

    const cls = direction === 'forward' ? 'anim-forward' : 'anim-backward';
    flipper.classList.add(cls);

    // Commit after exactly FLIP_MS — no waiting for animationend
    setTimeout(() => {
      flipper.classList.remove(cls);
      flipper.style.left = '-400%';  // park off screen
      spreadIndex = nextSI;
      renderStatic();                // confirm static pages
      updateUI();
      isAnimating = false;
      preloadAround(spreadIndex);
    }, FLIP_MS);
  }

  /* ── MUTE BUTTON ── */
  function initMute() {
    const btnMute   = document.getElementById('btn-mute');
    const iconSound = document.getElementById('icon-sound');
    const iconMuted = document.getElementById('icon-muted');
    btnMute.addEventListener('click', () => {
      muted = !muted;
      btnMute.classList.toggle('muted', muted);
      btnMute.title = btnMute.ariaLabel = muted ? 'Unmute sound' : 'Mute sound';
      iconSound.style.display = muted ? 'none'  : 'block';
      iconMuted.style.display = muted ? 'block' : 'none';
    });
  }

  /* ── INIT ── */
  function init() {
    totPageEl.textContent = TOTAL;
    sizeBook();
    renderStatic();
    updateUI();
    preloadAround(0);
    for (let i = 1; i <= PRELOAD_AHEAD; i++) preload(i);

    initMute();

    // Nav buttons
    btnNext.addEventListener('click', () => flip('forward'));
    btnPrev.addEventListener('click', () => flip('backward'));
    arrNext.addEventListener('click', () => flip('forward'));
    arrPrev.addEventListener('click', () => flip('backward'));

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); flip('forward'); }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')  { e.preventDefault(); flip('backward'); }
    });

    // Swipe (mobile)
    let tx = 0, ty = 0, tt = 0;
    document.addEventListener('touchstart', e => {
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
      tt = Date.now();
    }, { passive: true });
    document.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (Date.now() - tt > 500 || Math.abs(dx) < 35) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.3) return;
      flip(dx < 0 ? 'forward' : 'backward');
    }, { passive: true });

    // Resize
    window.addEventListener('resize', () => {
      sizeBook();
      renderStatic();
      updateUI();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
