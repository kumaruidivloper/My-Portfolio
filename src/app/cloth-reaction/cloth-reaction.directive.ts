import { AfterViewInit, Directive, DOCUMENT, ElementRef, NgZone, OnDestroy, inject } from '@angular/core';

@Directive({
  selector: '[appClothReaction]',
  standalone: true
})
export class ClothReactionDirective implements AfterViewInit, OnDestroy {
  private readonly host: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly zone = inject(NgZone);
  private readonly document = inject(DOCUMENT);
  private motion?: MediaQueryList;
  private observer?: IntersectionObserver;
  private frame?: number;
  private inView = false;

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.motion.addEventListener('change', this.updateAnimation);
      this.document.addEventListener('visibilitychange', this.updateAnimation);
      if (typeof IntersectionObserver === 'undefined') {
        this.inView = true;
        this.updateAnimation();
        return;
      }
      this.observer = new IntersectionObserver((entries) => {
        this.inView = entries.some((entry) => entry.isIntersecting);
        this.updateAnimation();
      });
      this.observer.observe(this.host);
    });
  }

  ngOnDestroy(): void {
    this.inView = false;
    this.observer?.disconnect();
    this.motion?.removeEventListener('change', this.updateAnimation);
    this.document.removeEventListener('visibilitychange', this.updateAnimation);
    this.updateAnimation();
  }

  private readonly updateAnimation = (): void => {
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
      this.frame = undefined;
    }
    if (!this.inView || this.motion?.matches || this.document.hidden) {
      this.host.querySelectorAll<HTMLElement>('[data-cloth-reactive]').forEach((element) => {
        element.style.removeProperty('--cloth-reaction');
      });
      return;
    }
    this.frame = requestAnimationFrame(this.animate);
  };

  private readonly animate = (): void => {
    const bulge = getComputedStyle(this.host, '::after');
    const matrix = new DOMMatrixReadOnly(bulge.transform === 'none' ? undefined : bulge.transform);
    const width = parseFloat(bulge.width);
    // Transforms act around the bulge's center; use layout offsets for targets to avoid feedback.
    const centerX = parseFloat(bulge.left) + width / 2 + matrix.m41;
    const centerY = parseFloat(bulge.top) + parseFloat(bulge.height) / 2 + matrix.m42;
    const radius = width * matrix.a / 2;
    const opacity = parseFloat(bulge.opacity);
    const reactions = Array.from(this.host.querySelectorAll<HTMLElement>('[data-cloth-reactive]'), (element) => {
      if (element.matches(':hover, :focus-within')) {
        return { element, transform: 'none' };
      }
      let x = element.offsetWidth / 2;
      let y = element.offsetHeight / 2;
      let parent: HTMLElement | null = element;
      while (parent && parent !== this.host) {
        x += parent.offsetLeft;
        y += parent.offsetTop;
        parent = parent.offsetParent instanceof HTMLElement ? parent.offsetParent : null;
      }
      const dx = (x - centerX) / radius;
      const dy = (y - centerY) / radius;
      const influence = Math.max(0, 1 - Math.hypot(dx, dy) / 1.35) ** 2 * opacity;
      return {
        element,
        transform: `perspective(900px) translate3d(${dx * influence * 5}px, ${dy * influence * 5 - influence * 6}px, 0) rotateX(${-dy * influence * 3}deg) rotateY(${dx * influence * 3}deg) scale(${1 + influence * 0.012})`
      };
    });
    reactions.forEach(({ element, transform }) => element.style.setProperty('--cloth-reaction', transform));
    this.frame = requestAnimationFrame(this.animate);
  };
}
