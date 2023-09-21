/**
 * Returns a modified T that does not contain keys O
 * @template T Some Constructor Type
 * @template O Some array of Properties on T
 */
type Reduced<
  T extends new (...args: any[]) => any,
  O extends PropertyKey[],
> = new (...args: ConstructorParameters<T>) => {
  [P in Exclude<keyof T, O[number]>]: T[P];
};

/**
 *
 * @param original Constructor to omit properties from
 * @param overrides Properties to omit from Constructor
 */
export function WithOverrides<
  T extends new (...args: any[]) => any,
  O extends PropertyKey[],
>(original: T, overrides: O): Reduced<T, O> {
  return original as Reduced<T, O>;
}
