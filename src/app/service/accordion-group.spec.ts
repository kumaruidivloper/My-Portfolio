import { announceAccordionOpened, collapseWhenAnotherOpens } from './accordion-group';

describe('accordion group', () => {
  it('collapses only when a different accordion opens', () => {
    const collapse = jasmine.createSpy('collapse');
    const subscription = collapseWhenAnotherOpens(() => 'a', collapse);

    announceAccordionOpened('a');
    expect(collapse).not.toHaveBeenCalled();

    announceAccordionOpened('b');
    expect(collapse).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
    announceAccordionOpened('b');
    expect(collapse).toHaveBeenCalledTimes(1);
  });
});
