// This file is auto-generated. Do not edit manually.
// Generated on: 2026-02-27T17:34:46.696Z

/**
 * Application version from package.json
 */
export const VERSION = '0.1.0';

/**
 * Build timestamp
 */
export const BUILD_TIMESTAMP = '2026-02-27T17:34:46.696Z';

/**
 * Returns the application version with build information
 */
// Fixed slice (not toLocaleString) so SSR and client render identically.
export const getVersionString = (): string => {
  return `v${VERSION} (Built: ${BUILD_TIMESTAMP.slice(0, 10)})`;
};
