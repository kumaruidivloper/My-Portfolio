/// <reference types="jasmine" />

import { memoizeLast } from './memoize';

describe('memoizeLast', () => {
  it('reuses the previous result until an argument changes by identity', () => {
    const compute = jasmine.createSpy('compute').and.callFake((items: number[], factor: number) => items.map((item) => item * factor));
    const memo = memoizeLast(compute);
    const items = [1, 2];

    const first = memo(items, 2);
    expect(memo(items, 2)).toBe(first);
    expect(compute).toHaveBeenCalledTimes(1);

    expect(memo(items, 3)).toEqual([3, 6]);
    expect(memo([1, 2], 3)).not.toBe(first);
    expect(compute).toHaveBeenCalledTimes(3);
  });
});
