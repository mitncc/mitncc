/**
 * TARANG — Page-Flip Magazine Viewer
 * script.js
 *
 * Single page on ALL screen sizes.
 * Book fills 100% of viewport width × (viewport height − topbar).
 * CSS 3D flip animation, zero lag, swipe + keyboard + button nav.
 */

(() => {
  'use strict';

  /* ── CONFIG ── */
  const TOTAL          = 85;
  const DIR            = 'pages/';
  const PRELOAD_AHEAD  = 4;

  /* ── PRELOAD CACHE ── */
  const cache = {};
  function preload(n) {
    if (n < 1 || n > TOTAL) return;
    const s = `${DIR}${n}.png`;
    if (cache[s]) return;
    const img = new Image();
    img.src = s;
    cache[s] = img;
  }
  function src(n) {
    return (n >= 1 && n <= TOTAL) ? `${DIR}${n}.png` : '';
  }

  /* ── STATE ── */
  let page        = 1;      // current page (1-based)
  let isAnimating = false;

  /* ── DOM ── */
  const topbar       = document.getElementById('topbar');
  const book         = document.getElementById('book');
  const leftImg      = document.getElementById('left-img');
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

  /* ── SIZE: book = full width × full remaining height ── */
  function sizeBook() {
    const w = window.innerWidth;
    const h = window.innerHeight - topbar.offsetHeight;
    book.style.width  = w + 'px';
    book.style.height = h + 'px';
    // Flipper always matches book size (reset to hidden)
    flipper.style.width  = w + 'px';
    flipper.style.height = h + 'px';
  }

  /* ── UI: counter + progress + button states ── */
  function updateUI() {
    curPageEl.textContent = page;
    progEl.style.width = (((page - 1) / (TOTAL - 1)) * 100).toFixed(1) + '%';
    btnPrev.disabled = arrPrev.disabled = (page <= 1);
    btnNext.disabled = arrNext.disabled = (page >= TOTAL);
  }

  /* ── RENDER: show current page with no animation ── */
  function renderStatic() {
    leftImg.src = src(page);
  }

  /* ── SOUND ── */
  let muted = false;
  let audioUnlocked = false;

  function unlockAudio() {
    if (audioUnlocked || !snd) return;
    audioUnlocked = true;
    snd.play().then(() => { snd.pause(); snd.currentTime = 0; }).catch(() => {});
  }
  // Unlock on very first interaction
  document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  document.addEventListener('mousedown',  unlockAudio, { once: true });

  function playSound() {
    if (!snd || muted) return;
    try { snd.currentTime = 0; snd.play().catch(() => {}); } catch (_) {}
  }

  /* ── FLIP ──────────────────────────────────────────────────────────
   *
   * Single-page flip:
   *
   * FORWARD (next page):
   *   - flipper covers full book, front = current page, back = next page
   *   - origin = LEFT edge  →  rotates -180° (peels from right to left)
   *   - static page swaps to next immediately (hidden under flipper)
   *
   * BACKWARD (prev page):
   *   - flipper covers full book, front = prev page (seen as back face),
   *     back = current page
   *   - origin = RIGHT edge → animates -180° → 0° (peels from left to right)
   *   - static page swaps to prev immediately
   *
   * ────────────────────────────────────────────────────────────────── */
  function flip(direction) {
    if (isAnimating) return;

    const nextPage = direction === 'forward' ? page + 1 : page - 1;
    if (nextPage < 1 || nextPage > TOTAL) return;

    isAnimating = true;
    playSound();

    // Position flipper over the full book
    flipper.style.left = '0';
    flipper.style.top  = '0';

    if (direction === 'forward') {
      // Front shows current page, back shows next
      flipFrontImg.src = src(page);
      flipBackImg.src  = src(nextPage);
      flipper.style.transformOrigin = 'left center';
      flipper.style.transform = 'rotateY(0deg)';
      // Swap static page to next now (it sits hidden under the flipper)
      leftImg.src = src(nextPage);
    } else {
      // Back shows current page, front shows prev (will be revealed as back rotates away)
      flipFrontImg.src = src(nextPage);
      flipBackImg.src  = src(page);
      flipper.style.transformOrigin = 'right center';
      flipper.style.transform = 'rotateY(-180deg)';
      // Swap static page to prev now
      leftImg.src = src(nextPage);
    }

    // Force reflow — ensures browser paints start state before animation
    void flipper.offsetWidth;

    // Trigger animation
    const cls = direction === 'forward' ? 'flip-forward' : 'flip-backward';
    flipper.classList.add(cls);

    flipper.addEventListener('animationend', () => {
      flipper.classList.remove(cls);
      // Park flipper off-screen
      flipper.style.left = '-300%';

      page = nextPage;
      renderStatic();   // static now correct (already set above, this just confirms)
      updateUI();
      isAnimating = false;

      // Preload neighbours
      for (let i = 1; i <= PRELOAD_AHEAD; i++) {
        preload(page + i);
        preload(page - i);
      }
    }, { once: true });
  }

  /* ── MUTE BUTTON ── */
  function initMute() {
    const btnMute   = document.getElementById('btn-mute');
    const iconSound = document.getElementById('icon-sound');
    const iconMuted = document.getElementById('icon-muted');

    btnMute.addEventListener('click', () => {
      muted = !muted;
      btnMute.classList.toggle('muted', muted);
      btnMute.title     = muted ? 'Unmute sound' : 'Mute sound';
      btnMute.ariaLabel = btnMute.title;
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

    // Park flipper off-screen initially
    flipper.style.left = '-300%';

    // Preload first few pages
    for (let i = 1; i <= PRELOAD_AHEAD; i++) preload(i);

    initMute();

    // Nav buttons
    btnNext.addEventListener('click', () => flip('forward'));
    btnPrev.addEventListener('click', () => flip('backward'));
    arrNext.addEventListener('click', () => flip('forward'));
    arrPrev.addEventListener('click', () => flip('backward'));

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); flip('forward');  }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp'  ) { e.preventDefault(); flip('backward'); }
    });

    // Swipe
    let tx = 0, ty = 0, tt = 0;
    document.addEventListener('touchstart', e => {
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
      tt = Date.now();
    }, { passive: true });
    document.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (Date.now() - tt > 500) return;
      if (Math.abs(dx) < 35) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.3) return; // too vertical
      flip(dx < 0 ? 'forward' : 'backward');
    }, { passive: true });

    // Resize: re-fit book
    window.addEventListener('resize', () => {
      sizeBook();
      updateUI();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
