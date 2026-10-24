// src/factory-options.ts
/**
 * @file factory-options.ts
 * @description Internal helper normalizing legacy positional router factory arguments.
 */

/**
 * Resolves router factory options provided either as a legacy base path string
 * with positional defaults or as a modern full options object.
 *
 * @param basePathOrOptions - Legacy base path string or modern options object.
 * @param build - Callback constructing the options object from a base path string.
 * @returns The resolved options object.
 */
export function resolveFactoryOptions<O>(
  basePathOrOptions: string | O,
  build: (basePath: string) => O,
): O {
  return typeof basePathOrOptions === "string"
    ? build(basePathOrOptions)
    : basePathOrOptions;
}
