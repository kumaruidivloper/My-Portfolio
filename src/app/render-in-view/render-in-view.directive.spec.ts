/// <reference types="jasmine" />

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { RenderInViewDirective } from './render-in-view.directive';

@Component({
  template: `<div class="host"><span class="card" *appRenderInView>Card</span></div>`,
  standalone: false
})
class HostComponent {}

describe('RenderInViewDirective', () => {
  let callback: IntersectionObserverCallback;
  let observe: jasmine.Spy;
  let disconnect: jasmine.Spy;

  const realObserver = window.IntersectionObserver;

  beforeEach(() => {
    observe = jasmine.createSpy('observe');
    disconnect = jasmine.createSpy('disconnect');
    window.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe = observe;
      disconnect = disconnect;
    } as unknown as typeof IntersectionObserver;
    TestBed.configureTestingModule({ declarations: [HostComponent, RenderInViewDirective] });
  });

  afterEach(() => {
    window.IntersectionObserver = realObserver;
  });

  const intersect = (isIntersecting: boolean) =>
    callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);

  it('shows a placeholder until it scrolls into view, then renders the template once', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement.querySelector('.host');
    const placeholder = host.querySelector('.widget-placeholder');

    expect(placeholder).not.toBeNull();
    expect(observe).toHaveBeenCalledWith(placeholder);
    expect(host.querySelector('.card')).toBeNull();

    intersect(false);
    expect(host.querySelector('.card')).toBeNull();

    intersect(true);
    fixture.detectChanges();
    expect(host.querySelector('.widget-placeholder')).toBeNull();
    expect(host.querySelectorAll('.card').length).toBe(1);
    expect(disconnect).toHaveBeenCalled();
  });

  it('stops observing and removes the placeholder when destroyed', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement.querySelector('.host');

    fixture.destroy();

    expect(disconnect).toHaveBeenCalled();
    expect(host.querySelector('.widget-placeholder')).toBeNull();
  });
});
