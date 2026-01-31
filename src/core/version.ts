/**
 * Version Utilities
 *
 * Handles semantic versioning operations for release-pilot.
 * Supports parsing, bumping, and creating dev/prerelease versions.
 *
 * @module core/version
 */

import * as semver from 'semver';

/**
 * Type of version bump to apply
 */
export type BumpType = 'major' | 'minor' | 'patch';

/**
 * Parsed version information
 */
export interface ParsedVersion {
  /** Major version number */
  major: number;
  /** Minor version number */
  minor: number;
  /** Patch version number */
  patch: number;
  /** Prerelease identifier (e.g., "dev.abc1234", "beta.1") */
  prerelease: string | undefined;
  /** Build metadata (e.g., "build.123") */
  build: string | undefined;
  /** Original raw version string */
  raw: string;
}

/**
 * Parse a version string into its components
 *
 * @param version - Version string to parse (with or without 'v' prefix)
 * @returns Parsed version object or null if invalid
 *
 * @example
 * parseVersion('1.2.3') // { major: 1, minor: 2, patch: 3, ... }
 * parseVersion('v1.2.3-dev.abc') // { major: 1, minor: 2, patch: 3, prerelease: 'dev.abc', ... }
 * parseVersion('invalid') // null
 */
export function parseVersion(version: string): ParsedVersion | null {
  const parsed = semver.parse(version);
  if (!parsed) {
    return null;
  }

  return {
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
    prerelease: parsed.prerelease.length > 0 ? parsed.prerelease.join('.') : undefined,
    build: parsed.build.length > 0 ? parsed.build.join('.') : undefined,
    raw: version,
  };
}

/**
 * Bump a version by the specified type
 *
 * @param version - Current version string
 * @param type - Type of bump (major, minor, patch)
 * @returns New version string (without v prefix)
 * @throws Error if version is invalid
 *
 * @example
 * bumpVersion('1.2.3', 'major') // '2.0.0'
 * bumpVersion('1.2.3', 'minor') // '1.3.0'
 * bumpVersion('1.2.3', 'patch') // '1.2.4'
 * bumpVersion('1.2.3-dev.abc', 'patch') // '1.2.4' (strips prerelease)
 */
export function bumpVersion(version: string, type: BumpType): string {
  const parsed = semver.parse(version);
  if (!parsed) {
    throw new Error(`Invalid version: ${version}`);
  }

  // Create a clean version without prerelease/build metadata
  // This ensures we always bump from the base version
  const cleanVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}`;

  const result = semver.inc(cleanVersion, type);
  if (!result) {
    throw new Error(`Failed to bump version: ${version}`);
  }
  return result;
}

/**
 * Create a development/prerelease version using timestamp
 *
 * Uses YYYYMMDDHHmmss format for proper semver sorting.
 *
 * @param baseVersion - Base version to create dev version from
 * @param suffix - Prerelease suffix (default: 'dev')
 * @returns Dev version string (e.g., "1.2.3-dev.20260131153000")
 *
 * @example
 * createDevVersion('1.2.3') // '1.2.3-dev.20260131153000'
 * createDevVersion('1.2.3', 'nightly') // '1.2.3-nightly.20260131153000'
 * createDevVersion('1.2.3', 'alpha') // '1.2.3-alpha.20260131153000'
 */
export function createDevVersion(baseVersion: string, suffix: string = 'dev'): string {
  // Strip v prefix if present
  const cleanVersion = baseVersion.replace(/^v/, '');

  // Parse to get clean major.minor.patch
  const parsed = semver.parse(cleanVersion);
  if (!parsed) {
    throw new Error(`Invalid version: ${baseVersion}`);
  }

  // Create timestamp in YYYYMMDDHHmmss format
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:T]/g, '')
    .replace(/\.\d+Z$/, '');

  return `${parsed.major}.${parsed.minor}.${parsed.patch}-${suffix}.${timestamp}`;
}

/**
 * Determine the highest priority bump type from a list
 *
 * Priority order: major > minor > patch
 *
 * @param bumps - Array of bump types
 * @param defaultBump - Default bump if array is empty (default: 'patch')
 * @returns Highest priority bump type
 *
 * @example
 * getHighestBump(['patch', 'minor', 'major']) // 'major'
 * getHighestBump(['patch', 'minor']) // 'minor'
 * getHighestBump([]) // 'patch'
 * getHighestBump([], 'minor') // 'minor'
 */
export function getHighestBump(bumps: BumpType[], defaultBump: BumpType = 'patch'): BumpType {
  if (bumps.length === 0) {
    return defaultBump;
  }

  // Normalize to lowercase for comparison
  const normalized = bumps.map((b) => b.toLowerCase() as BumpType);

  if (normalized.includes('major')) {
    return 'major';
  }
  if (normalized.includes('minor')) {
    return 'minor';
  }
  return 'patch';
}

/**
 * Check if a version is a prerelease
 *
 * @param version - Version string to check
 * @returns True if version has prerelease identifier
 *
 * @example
 * isPrerelease('1.2.3-dev.abc') // true
 * isPrerelease('1.2.3-alpha.1') // true
 * isPrerelease('1.2.3') // false
 * isPrerelease('1.2.3+build.123') // false (build metadata is not prerelease)
 */
export function isPrerelease(version: string): boolean {
  const parsed = semver.parse(version);
  if (!parsed) {
    return false;
  }
  return parsed.prerelease.length > 0;
}

/**
 * Compare two versions
 *
 * @param a - First version
 * @param b - Second version
 * @returns 1 if a > b, -1 if a < b, 0 if equal
 *
 * @example
 * compareVersions('2.0.0', '1.0.0') // 1
 * compareVersions('1.0.0', '2.0.0') // -1
 * compareVersions('1.0.0', '1.0.0') // 0
 * compareVersions('1.0.0', '1.0.0-dev.abc') // 1 (stable > prerelease)
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  return semver.compare(a, b);
}
