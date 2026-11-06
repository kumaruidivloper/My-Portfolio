let overlayOpenOnEscape = false;

// Capture runs before components close their own popups, so this reflects the state when Escape was pressed.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    overlayOpenOnEscape = document.querySelector('.cdk-overlay-pane') !== null;
  }
}, true);

/** True when a CDK overlay (select, date picker, options menu) was open as Escape was pressed and should consume it. */
export function isOverlayOpen(): boolean {
  return overlayOpenOnEscape;
}
