import { TestBed } from '@angular/core/testing';
import { ScrollProgressComponent } from './scroll-progress.component';

describe('ScrollProgressComponent', () => {
  it('tracks and clamps document scroll progress', () => {
    const scrollingElement = { scrollHeight: 2000, scrollTop: 0 };
    const component = Object.create(ScrollProgressComponent.prototype) as ScrollProgressComponent;
    Object.assign(component, {
      document: { scrollingElement, documentElement: { clientHeight: 500 } }
    });

    component.updateScrollProgress();
    expect(component.scrollProgress).toBe(0);
    scrollingElement.scrollTop = 750;
    component.updateScrollProgress();
    expect(component.scrollProgress).toBe(0.5);
    scrollingElement.scrollTop = 2000;
    component.updateScrollProgress();
    expect(component.scrollProgress).toBe(1);
    scrollingElement.scrollTop = -10;
    component.updateScrollProgress();
    expect(component.scrollProgress).toBe(0);
    scrollingElement.scrollHeight = 500;
    component.updateScrollProgress();
    expect(component.scrollProgress).toBe(0);
  });

  it('updates the displayed progress on window scroll and resize', () => {
    TestBed.configureTestingModule({ imports: [ScrollProgressComponent] });
    const scrollingElement = document.scrollingElement!;
    let scrollTop = 750;
    spyOnProperty(scrollingElement, 'scrollHeight', 'get').and.returnValue(2000);
    spyOnProperty(scrollingElement, 'scrollTop', 'get').and.callFake(() => scrollTop);
    spyOnProperty(document.documentElement, 'clientHeight', 'get').and.returnValue(500);
    const fixture = TestBed.createComponent(ScrollProgressComponent);
    fixture.detectChanges();

    const fill: HTMLElement = fixture.nativeElement.querySelector('.scroll-progress-fill');
    expect(fill.style.transform).toBe('scaleX(0.5)');
    scrollTop = 1500;
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(fill.style.transform).toBe('scaleX(1)');
    scrollTop = 0;
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(fill.style.transform).toBe('scaleX(0)');
    fixture.destroy();
  });

  it('tracks a supplied scroll container and removes its listener on destroy', () => {
    TestBed.configureTestingModule({ imports: [ScrollProgressComponent] });
    const container = document.createElement('main');
    let scrollTop = 500;
    spyOnProperty(container, 'scrollHeight', 'get').and.returnValue(1500);
    spyOnProperty(container, 'clientHeight', 'get').and.returnValue(500);
    spyOnProperty(container, 'scrollTop', 'get').and.callFake(() => scrollTop);
    const removeListener = spyOn(container, 'removeEventListener').and.callThrough();
    const fixture = TestBed.createComponent(ScrollProgressComponent);
    fixture.componentRef.setInput('scrollContainer', container);
    fixture.detectChanges();

    const fill: HTMLElement = fixture.nativeElement.querySelector('.scroll-progress-fill');
    expect(fill.style.transform).toBe('scaleX(0.5)');
    scrollTop = 1000;
    container.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(fill.style.transform).toBe('scaleX(1)');

    fixture.destroy();
    expect(removeListener).toHaveBeenCalledWith('scroll', jasmine.any(Function));
  });
});
