import { Subject, Subscription } from 'rxjs';

// Only one main dashboard accordion may be open at a time.
const accordionOpened = new Subject<string>();

export function announceAccordionOpened(id: string): void {
  accordionOpened.next(id);
}

export function collapseWhenAnotherOpens(ownId: () => string, collapse: () => void): Subscription {
  return accordionOpened.subscribe((openedId) => {
    if (openedId !== ownId()) {
      collapse();
    }
  });
}
