/**
 * Caches the last result and recomputes only when an argument changes (by identity).
 * Lets template getters return stable arrays/objects so charts and grids don't rebuild on every
 * change-detection pass. Inputs must be replaced, not mutated in place, to invalidate the cache.
 */
export function memoizeLast<Args extends readonly unknown[], Result>(
  compute: (...args: Args) => Result
): (...args: Args) => Result {
  let lastArgs: Args | null = null;
  let lastResult!: Result;
  return (...args: Args): Result => {
    if (lastArgs && lastArgs.length === args.length && args.every((arg, index) => Object.is(arg, lastArgs![index]))) {
      return lastResult;
    }
    lastResult = compute(...args);
    lastArgs = args;
    return lastResult;
  };
}
