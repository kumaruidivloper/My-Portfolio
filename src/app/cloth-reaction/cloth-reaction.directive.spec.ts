import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClothReactionDirective } from './cloth-reaction.directive';

@Component({
  imports: [ClothReactionDirective],
  template: `
    <section appClothReaction>
      <div class="near" data-cloth-reactive><input aria-label="Test input"></div>
      <div class="far" data-cloth-reactive>Far away</div>
    </section>
  `,
  styles: [`
    section { position: relative; width: 600px; height: 400px; }
    section::after {
      content: ""; position: absolute; width: 200px; height: 200px;
      left: 200px; top: 200px; transform: translate(-50%, -50%); opacity: 1;
    }
    [data-cloth-reactive] { position: absolute; width: 20px; height: 20px; }
    .near { left: 190px; top: 190px; }
    .far { left: 550px; top: 20px; }
    input { width: 20px; height: 20px; }
  `]
})
class TestHostComponent {}

class MotionPreference extends EventTarget implements MediaQueryList {
  matches = false;
  readonly media = '(prefers-reduced-motion: reduce)';
  onchange: MediaQueryList['onchange'] = null;
  addListener(): void {}
  removeListener(): void {}
}

describe('ClothReactionDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: HTMLElement;
  let motion: MotionPreference;
  let intersect: IntersectionObserverCallback;
  let observer: IntersectionObserver;
  let nextFrame: FrameRequestCallback;
  let requestFrame: jasmine.Spy;
  let hidden: boolean;

  beforeEach(() => {
    hidden = false;
    motion = new MotionPreference();
    spyOn(window, 'matchMedia').and.returnValue(motion);
    spyOnProperty(document, 'hidden', 'get').and.callFake(() => hidden);
    requestFrame = spyOn(window, 'requestAnimationFrame').and.callFake((callback) => {
      nextFrame = callback;
      return 1;
    });
    spyOn(window, 'cancelAnimationFrame');
    observer = {
      root: null, rootMargin: '0px', scrollMargin: '0px', thresholds: [0],
      observe: jasmine.createSpy('observe'),
      unobserve: jasmine.createSpy('unobserve'),
      disconnect: jasmine.createSpy('disconnect'),
      takeRecords: () => []
    };
    spyOn(window, 'IntersectionObserver').and.callFake(function(callback) {
      intersect = callback;
      return observer;
    });
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    fixture = TestBed.createComponent(TestHostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    host = fixture.nativeElement.querySelector('section');
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
  });

  function setVisible(visible: boolean): void {
    const rect = host.getBoundingClientRect();
    intersect([{
      target: host, isIntersecting: visible, intersectionRatio: visible ? 1 : 0,
      boundingClientRect: rect, intersectionRect: rect, rootBounds: null, time: 0
    }], observer);
  }

  it('lifts nearby elements while leaving distant elements at rest', () => {
    setVisible(true);
    nextFrame(0);
    const near = host.querySelector<HTMLElement>('.near')!;
    const far = host.querySelector<HTMLElement>('.far')!;
    expect(near.style.getPropertyValue('--cloth-reaction')).toContain('translate3d(0px, -6px, 0)');
    expect(near.style.getPropertyValue('--cloth-reaction')).toContain('scale(1.012)');
    expect(far.style.getPropertyValue('--cloth-reaction')).toContain('scale(1)');
  });

  it('keeps focused controls steady and picks up dynamically added elements', () => {
    setVisible(true);
    host.querySelector('input')!.focus();
    const preview = document.createElement('div');
    preview.className = 'near';
    preview.style.cssText = 'position: absolute; left: 190px; top: 190px; width: 20px; height: 20px';
    preview.setAttribute('data-cloth-reactive', '');
    host.appendChild(preview);
    nextFrame(0);
    expect(host.querySelector<HTMLElement>('.near')!.style.getPropertyValue('--cloth-reaction')).toBe('none');
    expect(preview.style.getPropertyValue('--cloth-reaction')).toContain('scale(1.012)');
  });

  it('resets reactions offscreen, when hidden, and for reduced motion, then cleans up', () => {
    setVisible(true);
    nextFrame(0);
    const near = host.querySelector<HTMLElement>('.near')!;
    expect(near.style.getPropertyValue('--cloth-reaction')).not.toBe('');
    setVisible(false);
    expect(near.style.getPropertyValue('--cloth-reaction')).toBe('');
    expect(window.cancelAnimationFrame).toHaveBeenCalled();

    setVisible(true);
    nextFrame(0);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(near.style.getPropertyValue('--cloth-reaction')).toBe('');
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    nextFrame(0);
    motion.matches = true;
    motion.dispatchEvent(new Event('change'));
    expect(near.style.getPropertyValue('--cloth-reaction')).toBe('');

    const requests = requestFrame.calls.count();
    fixture.destroy();
    motion.matches = false;
    motion.dispatchEvent(new Event('change'));
    expect(requestFrame.calls.count()).toBe(requests);
    expect(observer.disconnect).toHaveBeenCalled();
  });
});
