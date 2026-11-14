import { DestroyRef, Directive, ElementRef, Input, NgZone, OnInit, Renderer2, TemplateRef, ViewContainerRef, inject } from '@angular/core';

/**
 * Renders its template (creating its components and starting their data fetches) only once a
 * placeholder scrolls near the viewport. A light alternative to `@defer`, whose runtime would
 * otherwise land in the initial bundle.
 */
@Directive({
  selector: '[appRenderInView]',
  exportAs: 'appRenderInView',
  standalone: false
})
export class RenderInViewDirective implements OnInit {
  /** Optional extra class for the placeholder, so it reserves the same grid space as the card. */
  @Input('appRenderInView') placeholderClass = '';
  private readonly template = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly renderer = inject(Renderer2);
  private readonly anchor = inject(ElementRef<Comment>);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private observer?: IntersectionObserver;
  private placeholder?: HTMLElement;
  private rendered = false;

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.render();
      return;
    }

    const anchor: Comment = this.anchor.nativeElement;
    const placeholder: HTMLElement = this.renderer.createElement('div');
    this.renderer.addClass(placeholder, 'widget-placeholder');
    if (this.placeholderClass) {
      this.renderer.addClass(placeholder, this.placeholderClass);
    }
    this.renderer.setAttribute(placeholder, 'aria-hidden', 'true');
    this.renderer.insertBefore(this.renderer.parentNode(anchor), placeholder, anchor);
    this.placeholder = placeholder;

    this.observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }
      this.zone.run(() => this.render());
    }, { rootMargin: '200px 0px' });
    this.observer.observe(placeholder);

    this.destroyRef.onDestroy(() => {
      this.observer?.disconnect();
      this.placeholder?.remove();
    });
  }

  render(): void {
    if (this.rendered) { return; }
    this.rendered = true;
    this.observer?.disconnect();
    this.placeholder?.remove();
    this.viewContainer.createEmbeddedView(this.template);
  }
}
