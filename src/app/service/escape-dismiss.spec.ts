import { isOverlayOpen } from './escape-dismiss';

describe('escape-dismiss', () => {
  let overlay: HTMLDivElement;

  beforeEach(() => {
    overlay = document.createElement('div');
    overlay.className = 'cdk-overlay-pane';
  });

  afterEach(() => {
    overlay.remove();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });

  it('remembers whether an overlay was open when Escape was pressed', () => {
    document.body.appendChild(overlay);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    overlay.remove();

    expect(isOverlayOpen()).toBeTrue();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(isOverlayOpen()).toBeTrue();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(isOverlayOpen()).toBeFalse();
  });
});
