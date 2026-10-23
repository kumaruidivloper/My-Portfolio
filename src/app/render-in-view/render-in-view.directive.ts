import { DestroyRef, Directive, ElementRef, NgZone, OnInit, Renderer2, TemplateRef, ViewContainerRef, inject } from '@angular/core';

/**
 * Renders its template (creating its components and starting their data fetches) only once a
 * placeholder scrolls near the viewport. A light alternative to `@defer`, whose runtime would
 * otherwise land in the initial bundle.
 */
@Directive({
  selector: '[appRenderInView]',
  standalone: false
})
export class RenderInViewDirective implements OnInit {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly renderer = inject(Renderer2);
  private readonly anchor = inject(ElementRef<Comment>);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.viewContainer.createEmbeddedView(this.template);
      return;
    }

    const anchor: Comment = this.anchor.nativeElement;
    const placeholder: HTMLElement = this.renderer.createElement('div');
    this.renderer.addClass(placeholder, 'widget-placeholder');
    this.renderer.setAttribute(placeholder, 'aria-hidden', 'true');
    this.renderer.insertBefore(this.renderer.parentNode(anchor), placeholder, anchor);

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }
      observer.disconnect();
      placeholder.remove();
      this.zone.run(() => this.viewContainer.createEmbeddedView(this.template));
    }, { rootMargin: '200px 0px' });
    observer.observe(placeholder);

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      placeholder.remove();
    });
  }
}
