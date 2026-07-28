gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const sceneWrapper = document.querySelector('.scene-wrapper');
let isAnimating = false;

const getCarouselCellTransforms = (count, radius) => {
  const angleStep = 360 / count;
  return Array.from({ length: count }, (_, i) =>
    `rotateY(${i * angleStep}deg) translateZ(${radius}px)`
  );
};

const setupCarouselCells = (carousel) => {
  const wrapper = carousel.closest('.scene');
  const radius = parseFloat(wrapper.dataset.radius) || 500;
  const cells = carousel.querySelectorAll('.carousel__cell');
  getCarouselCellTransforms(cells.length, radius).forEach((t, i) => {
    cells[i].style.transform = t;
  });
};

const createScrollAnimation = (carousel) => {
  const wrapper = carousel.closest('.scene');
  const cards = carousel.querySelectorAll('.card');
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
  return carousel._timeline;
};

const animateGridItems = ({ items, centerX, centerY, direction, onComplete }) => {
  const itemData = Array.from(items).map((el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = centerX - cx;
    const dy = centerY - cy;
    return { el, dx, dy, dist: Math.hypot(dx, dy), isLeft: cx < centerX };
  });
  const maxDist = Math.max(...itemData.map((d) => d.dist), 1);
  const totalStagger = 0.025 * Math.max(itemData.length - 1, 0);
  let latest = { delay: -1, el: null };

  itemData.forEach(({ el, dx, dy, dist, isLeft }) => {
    const delay = Math.pow(direction === 'in' ? 1 - dist / maxDist : dist / maxDist, 1) * totalStagger;
    const rotationY = isLeft ? 100 : -100;
    if (direction === 'in') {
      gsap.fromTo(el, {
        transformOrigin: `50% 50% ${dx > 0 ? -dx * 0.8 : dx * 0.8}px`,
        autoAlpha: 0, y: dy * 0.5, scale: 0.5, rotationY,
      }, {
        y: 0, scale: 1, rotationY: 0, autoAlpha: 1, duration: 0.4, ease: 'sine', delay: delay + 0.1,
      });
      gsap.fromTo(el, { z: -3500 }, { z: 0, duration: 0.3, ease: 'expo', delay });
    } else {
      if (delay > latest.delay) latest = { delay, el };
      gsap.to(el, {
        startAt: { transformOrigin: `50% 50% ${dx > 0 ? -dx * 0.8 : dx * 0.8}px` },
        y: dy * 0.4, rotationY, scale: 0.4, autoAlpha: 0, duration: 0.4, ease: 'sine.in', delay,
      });
      gsap.to(el, {
        z: -3500, duration: 0.4, ease: 'expo.in', delay: delay + 0.9,
        onComplete: el === latest.el ? onComplete : undefined,
      });
    }
  });
};

const activatePreview = (e) => {
  e.preventDefault();
  if (isAnimating) return;
  isAnimating = true;
  const titleEl = e.currentTarget;
  const wrapper = titleEl.closest('.scene');
  const carousel = wrapper.querySelector('.carousel');
  const cards = carousel.querySelectorAll('.card');
  const targetY = wrapper.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2 + wrapper.offsetHeight / 2;
  ScrollTrigger.getAll().forEach((t) => t.disable(false));

  gsap.timeline({
    defaults: { duration: 1.5, ease: 'power2.inOut' },
    onComplete: () => {
      isAnimating = false;
      ScrollTrigger.getAll().forEach((t) => t.enable());
      if (carousel._timeline && carousel._timeline.scrollTrigger) {
        carousel._timeline.scrollTrigger.scroll(targetY);
      }
    },
  })
    .to(window, { scrollTo: { y: targetY, autoKill: true } })
    .to(carousel, { rotationX: 90, rotationY: -360, z: -2000 }, 0)
    .to(carousel, {
      duration: 2.5, ease: 'power3.inOut', z: 1500, rotationZ: 270,
      onComplete: () => gsap.set(sceneWrapper, { autoAlpha: 0 }),
    }, 0.7)
    .to(cards, { rotationZ: 0 }, 0)
    .add(() => {
      const a = titleEl.querySelector('a');
      const href = a && a.getAttribute('href');
      const preview = href && document.querySelector(href);
      if (preview) {
        gsap.set(preview, { pointerEvents: 'auto', autoAlpha: 1 });
        const items = preview.querySelectorAll('.grid__item');
        gsap.set(items, { clearProps: 'all' });
        animateGridItems({
          items,
          centerX: window.innerWidth / 2,
          centerY: window.innerHeight / 2,
          direction: 'in',
        });
      }
    }, '<+=1.9');
};

const deactivatePreview = (e) => {
  if (isAnimating) return;
  isAnimating = true;
  const preview = e.currentTarget.closest('.preview');
  if (!preview) return;
  const id = '#' + preview.id;
  const titleLink = document.querySelector('.scene__title a[href="' + id + '"]');
  const titleEl = titleLink && titleLink.closest('.scene__title');
  const wrapper = titleEl && titleEl.closest('.scene');
  const carousel = wrapper && wrapper.querySelector('.carousel');
  const cards = carousel && carousel.querySelectorAll('.card');

  const items = preview.querySelectorAll('.grid__item');
  animateGridItems({
    items,
    centerX: window.innerWidth / 2,
    centerY: window.innerHeight / 2,
    direction: 'out',
    onComplete: () => gsap.set(preview, { pointerEvents: 'none', autoAlpha: 0 }),
  });

  gsap.set(sceneWrapper, { autoAlpha: 1 });
  const progress = 0.5;
  const rotationY = gsap.utils.interpolate(0, -180, progress);
  const rotationX = gsap.utils.interpolate(3, -3, progress);
  const rotationZ = gsap.utils.interpolate(3, -3, progress);

  gsap.timeline({
    delay: 0.7,
    defaults: { duration: 1.3, ease: 'expo' },
    onComplete: () => { isAnimating = false; },
  })
    .fromTo(carousel, {
      z: -550, rotationX, rotationY: -720, rotationZ, yPercent: 300,
    }, {
      rotationY, yPercent: 0,
    }, 0)
    .fromTo(cards, { autoAlpha: 0 }, { autoAlpha: 1 }, 0.3);
};

const init = () => {
  document.querySelectorAll('.carousel').forEach((c) => {
    setupCarouselCells(c);
    createScrollAnimation(c);
  });
  document.querySelectorAll('.scene__title').forEach((t) => {
    t.addEventListener('click', activatePreview);
  });
  document.querySelectorAll('.preview__close').forEach((b) => {
    b.addEventListener('click', deactivatePreview);
  });
  window.addEventListener('resize', () => ScrollTrigger.refresh());
  document.body.classList.remove('loading');
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
