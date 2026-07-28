import { preloadImages } from './utils.js';
try {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
  if (typeof ScrollSmoother !== 'undefined') gsap.registerPlugin(ScrollSmoother);
  if (typeof SplitText !== 'undefined') gsap.registerPlugin(SplitText);
} catch (e) { console.warn(e); }
let smoother = null;
try {
  if (typeof ScrollSmoother !== 'undefined') {
    smoother = ScrollSmoother.create({ wrapper: '#smooth-wrapper', content: '#smooth-content', smooth: 1, effects: true, normalizeScroll: true });
  }
} catch (e) { console.warn('ScrollSmoother failed', e); }
const sceneWrapper = document.querySelector('.scene-wrapper');
let isAnimating = false;
const splitMap = new Map();
const getCarouselCellTransforms = (count, radius) => {
  const angleStep = 360 / count;
  return Array.from({ length: count }, (_, i) => `rotateY(${i * angleStep}deg) translateZ(${radius}px)`);
};
const setupCarouselCells = (carousel) => {
  const wrapper = carousel.closest('.scene');
  const radius = parseFloat(wrapper.dataset.radius) || 500;
  const cells = carousel.querySelectorAll('.carousel__cell');
  getCarouselCellTransforms(cells.length, radius).forEach((t, i) => { cells[i].style.transform = t; });
};
const createScrollAnimation = (carousel) => {
  const wrapper = carousel.closest('.scene');
  const cards = carousel.querySelectorAll('.card');
  const titleSpan = wrapper.querySelector('.scene__title span');
  const chars = splitMap.get(titleSpan)?.chars || [];
  carousel._timeline = gsap.timeline({
    defaults: { ease: 'sine.inOut' },
    scrollTrigger: { trigger: wrapper, start: 'top bottom', end: 'bottom top', scrub: true },
  });
  carousel._timeline
    .fromTo(carousel, { rotationY: 0 }, { rotationY: -180 }, 0)
    .fromTo(carousel, { rotationZ: 3, rotationX: 3 }, { rotationZ: -3, rotationX: -3 }, 0)
    .fromTo(cards, { filter: 'brightness(250%)' }, { filter: 'brightness(80%)', ease: 'power3' }, 0)
    .fromTo(cards, { rotationZ: 10 }, { rotationZ: -10, ease: 'none' }, 0);
  if (chars.length) animateChars(chars, 'in', { scrollTrigger: { trigger: wrapper, start: 'top center', toggleActions: 'play none none reverse' } });
  return carousel._timeline;
};
const initTextsSplit = () => {
  if (typeof SplitText === 'undefined') return;
  document.querySelectorAll('.scene__title span, .preview__title span, .preview__close').forEach((span) => {
    try {
      const split = SplitText.create ? SplitText.create(span, { type: 'chars', charsClass: 'char', autoSplit: true }) : new SplitText(span, { type: 'chars', charsClass: 'char' });
      splitMap.set(span, split);
    } catch (e) {}
  });
};
const getInterpolatedRotation = (p) => ({ rotationY: gsap.utils.interpolate(0, -180, p), rotationX: gsap.utils.interpolate(3, -3, p), rotationZ: gsap.utils.interpolate(3, -3, p) });
const animateGridItemIn = (el, dx, dy, rotationY, delay) => {
  gsap.fromTo(el, { transformOrigin: `50% 50% ${dx > 0 ? -dx * 0.8 : dx * 0.8}px`, autoAlpha: 0, y: dy * 0.5, scale: 0.5, rotationY }, { y: 0, scale: 1, rotationY: 0, autoAlpha: 1, duration: 0.4, ease: 'sine', delay: delay + 0.1 });
  gsap.fromTo(el, { z: -3500 }, { z: 0, duration: 0.3, ease: 'expo', delay });
};
const animateGridItemOut = (el, dx, dy, rotationY, delay, isLast, onComplete) => {
  gsap.to(el, { startAt: { transformOrigin: `50% 50% ${dx > 0 ? -dx * 0.8 : dx * 0.8}px` }, y: dy * 0.4, rotationY, scale: 0.4, autoAlpha: 0, duration: 0.4, ease: 'sine.in', delay });
  gsap.to(el, { z: -3500, duration: 0.4, ease: 'expo.in', delay: delay + 0.9, onComplete: isLast ? onComplete : undefined });
};
const animateGridItems = ({ items, centerX, centerY, direction = 'in', onComplete }) => {
  const itemData = Array.from(items).map((el) => {
    const r = el.getBoundingClientRect();
    const dx = centerX - (r.left + r.width / 2), dy = centerY - (r.top + r.height / 2);
    return { el, dx, dy, dist: Math.hypot(dx, dy), isLeft: r.left + r.width / 2 < centerX };
  });
  const maxDist = Math.max(...itemData.map((d) => d.dist)) || 1;
  const totalStagger = 0.025 * Math.max(itemData.length - 1, 0);
  let latest = { delay: -1, el: null };
  itemData.forEach(({ el, dx, dy, dist, isLeft }) => {
    const delay = Math.pow(direction === 'in' ? 1 - dist / maxDist : dist / maxDist, 1) * totalStagger;
    const rotationY = isLeft ? 100 : -100;
    if (direction === 'in') animateGridItemIn(el, dx, dy, rotationY, delay);
    else { if (delay > latest.delay) latest = { delay, el }; animateGridItemOut(el, dx, dy, rotationY, delay, false, onComplete); }
  });
  if (direction === 'out' && latest.el) {
    const d = itemData.find((x) => x.el === latest.el);
    animateGridItemOut(d.el, d.dx, d.dy, d.isLeft ? 100 : -100, latest.delay, true, onComplete);
  }
};
const animatePreviewGridIn = (preview) => {
  const items = preview.querySelectorAll('.grid__item');
  gsap.set(items, { clearProps: 'all' });
  animateGridItems({ items, centerX: innerWidth / 2, centerY: innerHeight / 2, direction: 'in' });
};
const animatePreviewGridOut = (preview) => {
  const items = preview.querySelectorAll('.grid__item');
  animateGridItems({ items, centerX: innerWidth / 2, centerY: innerHeight / 2, direction: 'out', onComplete: () => gsap.set(preview, { pointerEvents: 'none', autoAlpha: 0 }) });
};
const getSceneElementsFromTitle = (titleEl) => {
  const wrapper = titleEl.closest('.scene');
  const carousel = wrapper?.querySelector('.carousel');
  const span = titleEl.querySelector('span');
  return { wrapper, carousel, cards: carousel?.querySelectorAll('.card'), span, chars: splitMap.get(span)?.chars || [] };
};
const getSceneElementsFromPreview = (previewEl) => {
  const titleLink = document.querySelector(`.scene__title a[href="#${previewEl.id}"]`);
  return { ...getSceneElementsFromTitle(titleLink?.closest('.scene__title')), titleEl: titleLink?.closest('.scene__title') };
};
const animateChars = (chars, direction = 'in', opts = {}) => {
  if (!chars?.length) return;
  gsap.fromTo(chars, { autoAlpha: direction === 'in' ? 0 : 1 }, { autoAlpha: direction === 'in' ? 1 : 0, duration: 0.02, ease: 'none', stagger: { each: 0.04, from: direction === 'in' ? 'start' : 'end' }, ...opts });
};
const animatePreviewTexts = (preview, direction = 'in') => {
  preview.querySelectorAll('.preview__title span, .preview__close').forEach((el) => animateChars(splitMap.get(el)?.chars || [], direction));
};
const activatePreviewFromCarousel = (e) => {
  e.preventDefault();
  if (isAnimating) return;
  isAnimating = true;
  const titleEl = e.currentTarget;
  const { wrapper, carousel, cards, chars } = getSceneElementsFromTitle(titleEl);
  const targetY = wrapper.getBoundingClientRect().top + scrollY - innerHeight / 2 + wrapper.offsetHeight / 2;
  ScrollTrigger.getAll().forEach((t) => t.disable(false));
  gsap.timeline({
    defaults: { duration: 1.5, ease: 'power2.inOut' },
    onComplete: () => { isAnimating = false; ScrollTrigger.getAll().forEach((t) => t.enable()); if (carousel._timeline?.scrollTrigger) carousel._timeline.scrollTrigger.scroll(targetY); },
  })
    .to(window, { onStart: lockUserScroll, onComplete: () => { unlockUserScroll(); if (smoother) smoother.paused(true); }, scrollTo: { y: targetY, autoKill: true } })
    .to(chars, { autoAlpha: 0, duration: 0.02, ease: 'none', stagger: { each: 0.04, from: 'end' } }, 0)
    .to(carousel, { rotationX: 90, rotationY: -360, z: -2000 }, 0)
    .to(carousel, { duration: 2.5, ease: 'power3.inOut', z: 1500, rotationZ: 270, onComplete: () => gsap.set(sceneWrapper, { autoAlpha: 0 }) }, 0.7)
    .to(cards, { rotationZ: 0 }, 0)
    .add(() => {
      const preview = document.querySelector(titleEl.querySelector('a')?.getAttribute('href'));
      if (preview) { gsap.set(preview, { pointerEvents: 'auto', autoAlpha: 1 }); animatePreviewGridIn(preview); animatePreviewTexts(preview, 'in'); }
    }, '<+=1.9');
};
const deactivatePreviewToCarousel = (e) => {
  if (isAnimating) return;
  isAnimating = true;
  const preview = e.currentTarget.closest('.preview');
  if (!preview) return;
  const { carousel, cards, chars } = getSceneElementsFromPreview(preview);
  animatePreviewTexts(preview, 'out');
  animatePreviewGridOut(preview);
  gsap.set(sceneWrapper, { autoAlpha: 1 });
  const { rotationX, rotationY, rotationZ } = getInterpolatedRotation(0.5);
  gsap.timeline({ delay: 0.7, defaults: { duration: 1.3, ease: 'expo' }, onComplete: () => { if (smoother) smoother.paused(false); isAnimating = false; } })
    .fromTo(chars, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02, ease: 'none', stagger: { each: 0.04, from: 'start' } })
    .fromTo(carousel, { z: -550, rotationX, rotationY: -720, rotationZ, yPercent: 300 }, { rotationY, yPercent: 0 }, 0)
    .fromTo(cards, { autoAlpha: 0 }, { autoAlpha: 1 }, 0.3);
};
const initEventListeners = () => {
  document.querySelectorAll('.scene__title').forEach((t) => t.addEventListener('click', activatePreviewFromCarousel));
  document.querySelectorAll('.preview__close').forEach((b) => b.addEventListener('click', deactivatePreviewToCarousel));
};
const initCarousels = () => {
  document.querySelectorAll('.carousel').forEach((c) => { setupCarouselCells(c); c._timeline = createScrollAnimation(c); });
};
function preventScroll(e) { e.preventDefault(); }
function lockUserScroll() {
  addEventListener('wheel', preventScroll, { passive: false });
  addEventListener('touchmove', preventScroll, { passive: false });
  addEventListener('keydown', preventArrowScroll, false);
}
function unlockUserScroll() {
  removeEventListener('wheel', preventScroll);
  removeEventListener('touchmove', preventScroll);
  removeEventListener('keydown', preventArrowScroll);
}
function preventArrowScroll(e) {
  if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key)) e.preventDefault();
}
const init = () => {
  try { initTextsSplit(); initCarousels(); initEventListeners(); addEventListener('resize', () => ScrollTrigger.refresh()); } catch (e) { console.error(e); }
};
const startApp = () => { document.body.classList.remove('loading'); init(); };
Promise.race([preloadImages('.grid__item-image, .card__face'), new Promise((r) => setTimeout(r, 2000))]).then(startApp);
