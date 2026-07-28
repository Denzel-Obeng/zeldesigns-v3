// Import utility function for preloading images
import { preloadImages } from './utils.js';

// Register the GSAP plugins
gsap.registerPlugin(ScrollTrigger, ScrollSmoother, ScrollToPlugin, SplitText);

// Initialize GSAP's ScrollSmoother for smooth scrolling and scroll-based effects
const smoother = ScrollSmoother.create({
  smooth: 1,
  effects: true,
  normalizeScroll: true,
});

const sceneWrapper = document.querySelector('.scene-wrapper');
let isAnimating = false;
const splitMap = new Map();

const getCarouselCellTransforms = (count, radius) => {
  const angleStep = 360 / count;
  return Array.from({ length: count }, (_, i) => {
    const angle = i * angleStep;
    return `rotateY(${angle}deg) translateZ(${radius}px)`;
  });
};

const setupCarouselCells = (carousel) => {
  const wrapper = carousel.closest('.scene');
  const radius = parseFloat(wrapper.dataset.radius) || 500;
  const cells = carousel.querySelectorAll('.carousel__cell');
  const transforms = getCarouselCellTransforms(cells.length, radius);
  cells.forEach((cell, i) => {
    cell.style.transform = transforms[i];
  });
};

const createScrollAnimation = (carousel) => {
  const wrapper = carousel.closest('.scene');
  const cards = carousel.querySelectorAll('.card');
  const titleSpan = wrapper.querySelector('.scene__title span');
  const split = splitMap.get(titleSpan);
  const chars = split?.chars || [];

  carousel._timeline = gsap.timeline({
    defaults: { ease: 'sine.inOut' },
    scrollTrigger: {
      trigger: wrapper,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    },
  });

  carousel._timeline
    .fromTo(carousel, { rotationY: 0 }, { rotationY: -180 }, 0)
    .fromTo(carousel, { rotationZ: 3, rotationX: 3 }, { rotationZ: -3, rotationX: -3 }, 0)
    .fromTo(cards, { filter: 'brightness(250%)' }, { filter: 'brightness(80%)', ease: 'power3' }, 0)
    .fromTo(cards, { rotationZ: 10 }, { rotationZ: -10, ease: 'none' }, 0);

  if (chars.length > 0) {
    animateChars(chars, 'in', {
      scrollTrigger: {
        trigger: wrapper,
        start: 'top center',
        toggleActions: 'play none none reverse',
      },
    });
  }

  return carousel._timeline;
};

const initTextsSplit = () => {
  document.querySelectorAll('.scene__title span, .preview__title span, .preview__close').forEach((span) => {
    const split = SplitText.create(span, {
      type: 'chars',
      charsClass: 'char',
      autoSplit: true,
    });
    splitMap.set(span, split);
  });
};

const getInterpolatedRotation = (progress) => ({
  rotationY: gsap.utils.interpolate(0, -180, progress),
  rotationX: gsap.utils.interpolate(3, -3, progress),
  rotationZ: gsap.utils.interpolate(3, -3, progress),
});

const animateGridItemIn = (el, dx, dy, rotationY, delay) => {
  gsap.fromTo(el, {
    transformOrigin: `50% 50% ${dx > 0 ? -dx * 0.8 : dx * 0.8}px`,
    autoAlpha: 0,
    y: dy * 0.5,
    scale: 0.5,
    rotationY: dx < 0 ? rotationY : rotationY,
  }, {
    y: 0,
    scale: 1,
    rotationY: 0,
    autoAlpha: 1,
    duration: 0.4,
    ease: 'sine',
    delay: delay + 0.1,
  });
  gsap.fromTo(el, { z: -3500 }, { z: 0, duration: 0.3, ease: 'expo', delay });
};

const animateGridItemOut = (el, dx, dy, rotationY, delay, isLast, onComplete) => {
  gsap.to(el, {
    startAt: { transformOrigin: `50% 50% ${dx > 0 ? -dx * 0.8 : dx * 0.8}px` },
    y: dy * 0.4,
    rotationY: dx < 0 ? rotationY : rotationY,
    scale: 0.4,
    autoAlpha: 0,
    duration: 0.4,
    ease: 'sine.in',
    delay,
  });
  gsap.to(el, {
    z: -3500,
    duration: 0.4,
    ease: 'expo.in',
    delay: delay + 0.9,
    onComplete: isLast ? onComplete : undefined,
  });
};

const animateGridItems = ({ items, centerX, centerY, direction = 'in', onComplete }) => {
  const itemData = Array.from(items).map((el) => {
    const rect = el.getBoundingClientRect();
    const elCenterX = rect.left + rect.width / 2;
    const elCenterY = rect.top + rect.height / 2;
    const dx = centerX - elCenterX;
    const dy = centerY - elCenterY;
    const dist = Math.hypot(dx, dy);
    const isLeft = elCenterX < centerX;
    return { el, dx, dy, dist, isLeft };
  });

  const maxDist = Math.max(...itemData.map((d) => d.dist));
  const totalStagger = 0.025 * (itemData.length - 1);
  let latest = { delay: -1, el: null };

  itemData.forEach(({ el, dx, dy, dist, isLeft }) => {
    const norm = maxDist ? dist / maxDist : 0;
    const exponential = Math.pow(direction === 'in' ? 1 - norm : norm, 1);
    const delay = exponential * totalStagger;
    const rotationY = isLeft ? 100 : -100;

    if (direction === 'in') {
      animateGridItemIn(el, dx, dy, rotationY, delay);
    } else {
      if (delay > latest.delay) latest = { delay, el };
      animateGridItemOut(el, dx, dy, rotationY, delay, false, onComplete);
    }
  });

  if (direction === 'out' && latest.el) {
    const { el, dx, dy, isLeft } = itemData.find((d) => d.el === latest.el);
    const rotationY = isLeft ? 100 : -100;
    animateGridItemOut(el, dx, dy, rotationY, latest.delay, true, onComplete);
  }
};

const animatePreviewGridIn = (preview) => {
  const items = preview.querySelectorAll('.grid__item');
  gsap.set(items, { clearProps: 'all' });
  animateGridItems({
    items,
    centerX: window.innerWidth / 2,
    centerY: window.innerHeight / 2,
    direction: 'in',
  });
};

const animatePreviewGridOut = (preview) => {
  const items = preview.querySelectorAll('.grid__item');
  const onComplete = () => gsap.set(preview, { pointerEvents: 'none', autoAlpha: 0 });
  animateGridItems({
    items,
    centerX: window.innerWidth / 2,
    centerY: window.innerHeight / 2,
    direction: 'out',
    onComplete,
  });
};

const getSceneElementsFromTitle = (titleEl) => {
  const wrapper = titleEl.closest('.scene');
  const carousel = wrapper?.querySelector('.carousel');
  const cards = carousel?.querySelectorAll('.card');
  const span = titleEl.querySelector('span');
  const chars = splitMap.get(span)?.chars || [];
  return { wrapper, carousel, cards, span, chars };
};

const getSceneElementsFromPreview = (previewEl) => {
  const previewId = `#${previewEl.id}`;
  const titleLink = document.querySelector(`.scene__title a[href="${previewId}"]`);
  const titleEl = titleLink?.closest('.scene__title');
  return { ...getSceneElementsFromTitle(titleEl), titleEl };
};

const animateChars = (chars, direction = 'in', opts = {}) => {
  const base = {
    autoAlpha: direction === 'in' ? 1 : 0,
    duration: 0.02,
    ease: 'none',
    stagger: { each: 0.04, from: direction === 'in' ? 'start' : 'end' },
    ...opts,
  };
  gsap.fromTo(chars, { autoAlpha: direction === 'in' ? 0 : 1 }, base);
};

const animatePreviewTexts = (preview, direction = 'in', selector = '.preview__title span, .preview__close') => {
  preview.querySelectorAll(selector).forEach((el) => {
    const chars = splitMap.get(el)?.chars || [];
    animateChars(chars, direction);
  });
};

const activatePreviewFromCarousel = (e) => {
  e.preventDefault();
  if (isAnimating) return;
  isAnimating = true;

  const titleEl = e.currentTarget;
  const { wrapper, carousel, cards, chars } = getSceneElementsFromTitle(titleEl);

  const offsetTop = wrapper.getBoundingClientRect().top + window.scrollY;
  const targetY = offsetTop - window.innerHeight / 2 + wrapper.offsetHeight / 2;

  ScrollTrigger.getAll().forEach((t) => t.disable(false));

  gsap.timeline({
    defaults: { duration: 1.5, ease: 'power2.inOut' },
    onComplete: () => {
      isAnimating = false;
      ScrollTrigger.getAll().forEach((t) => t.enable());
      carousel._timeline.scrollTrigger.scroll(targetY);
    },
  })
    .to(window, {
      onStart: () => lockUserScroll(),
      onComplete: () => {
        unlockUserScroll();
        smoother.paused(true);
      },
      scrollTo: { y: targetY, autoKill: true },
    })
    .to(chars, {
      autoAlpha: 0,
      duration: 0.02,
      ease: 'none',
      stagger: { each: 0.04, from: 'end' },
    }, 0)
    .to(carousel, { rotationX: 90, rotationY: -360, z: -2000 }, 0)
    .to(carousel, {
      duration: 2.5,
      ease: 'power3.inOut',
      z: 1500,
      rotationZ: 270,
      onComplete: () => gsap.set(sceneWrapper, { autoAlpha: 0 }),
    }, 0.7)
    .to(cards, { rotationZ: 0 }, 0)
    .add(() => {
      const previewSelector = titleEl.querySelector('a')?.getAttribute('href');
      const preview = document.querySelector(previewSelector);
      gsap.set(preview, { pointerEvents: 'auto', autoAlpha: 1 });
      animatePreviewGridIn(preview);
      animatePreviewTexts(preview, 'in');
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

  const progress = 0.5;
  const { rotationX, rotationY, rotationZ } = getInterpolatedRotation(progress);

  gsap.timeline({
    delay: 0.7,
    defaults: { duration: 1.3, ease: 'expo' },
    onComplete: () => {
      smoother.paused(false);
      isAnimating = false;
    },
  })
    .fromTo(chars, { autoAlpha: 0 }, {
      autoAlpha: 1,
      duration: 0.02,
      ease: 'none',
      stagger: { each: 0.04, from: 'start' },
    })
    .fromTo(carousel, {
      z: -550,
      rotationX,
      rotationY: -720,
      rotationZ,
      yPercent: 300,
    }, {
      rotationY,
      yPercent: 0,
    }, 0)
    .fromTo(cards, { autoAlpha: 0 }, { autoAlpha: 1 }, 0.3);
};

const initEventListeners = () => {
  document.querySelectorAll('.scene__title').forEach((title) => {
    title.addEventListener('click', activatePreviewFromCarousel);
  });
  document.querySelectorAll('.preview__close').forEach((btn) => {
    btn.addEventListener('click', deactivatePreviewToCarousel);
  });
};

const initCarousels = () => {
  document.querySelectorAll('.carousel').forEach((carousel) => {
    setupCarouselCells(carousel);
    carousel._timeline = createScrollAnimation(carousel);
  });
};

function preventScroll(e) { e.preventDefault(); }
function lockUserScroll() {
  window.addEventListener('wheel', preventScroll, { passive: false });
  window.addEventListener('touchmove', preventScroll, { passive: false });
  window.addEventListener('keydown', preventArrowScroll, false);
}
function unlockUserScroll() {
  window.removeEventListener('wheel', preventScroll);
  window.removeEventListener('touchmove', preventScroll);
  window.removeEventListener('keydown', preventArrowScroll);
}
function preventArrowScroll(e) {
  const keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
  if (keys.includes(e.key)) e.preventDefault();
}

const init = () => {
  initTextsSplit();
  initCarousels();
  initEventListeners();
  window.addEventListener('resize', ScrollTrigger.refresh);
};

preloadImages('.grid__item-image, .card__face').then(() => {
  document.body.classList.remove('loading');
  init();
});
