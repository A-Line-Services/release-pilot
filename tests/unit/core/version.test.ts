/**
 * Tests for version utilities
 *
 * These utilities handle semantic versioning operations including:
 * - Parsing version strings
 * - Bumping versions (major, minor, patch)
 * - Creating dev/prerelease versions
 * - Determining the highest bump type from multiple labels
 */

import { describe, expect, test } from 'bun:test';
import {
  type BumpType,
  bumpVersion,
  compareVersions,
  createDevVersion,
  getHighestBump,
  isPrerelease,
  parseVersion,
} from '../../../src/core/version.js';

describe('version utilities', () => {
  describe('parseVersion', () => {
    test('parses simple semver', () => {
      const result = parseVersion('1.2.3');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: undefined,
        build: undefined,
        raw: '1.2.3',
      });
    });

    test('parses version with v prefix', () => {
      const result = parseVersion('v1.2.3');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: undefined,
        build: undefined,
        raw: 'v1.2.3',
      });
    });

    test('parses version with prerelease', () => {
      const result = parseVersion('1.2.3-dev.abc1234');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'dev.abc1234',
        build: undefined,
        raw: '1.2.3-dev.abc1234',
      });
    });

    test('parses version with build metadata', () => {
      const result = parseVersion('1.2.3+build.123');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: undefined,
        build: 'build.123',
        raw: '1.2.3+build.123',
      });
    });

    test('parses version with prerelease and build', () => {
      const result = parseVersion('1.2.3-beta.1+build.456');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'beta.1',
        build: 'build.456',
        raw: '1.2.3-beta.1+build.456',
      });
    });

    test('returns null for invalid version', () => {
      expect(parseVersion('not-a-version')).toBeNull();
      expect(parseVersion('')).toBeNull();
      expect(parseVersion('1.2')).toBeNull();
      expect(parseVersion('1.2.3.4')).toBeNull();
    });
  });

  describe('bumpVersion', () => {
    test('bumps major version', () => {
      expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
    });

    test('bumps minor version', () => {
      expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
    });

    test('bumps patch version', () => {
      expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
    });

    test('handles v prefix', () => {
      expect(bumpVersion('v1.2.3', 'major')).toBe('2.0.0');
      expect(bumpVersion('v1.2.3', 'minor')).toBe('1.3.0');
      expect(bumpVersion('v1.2.3', 'patch')).toBe('1.2.4');
    });

    test('strips prerelease when bumping', () => {
      expect(bumpVersion('1.2.3-dev.abc1234', 'patch')).toBe('1.2.4');
      expect(bumpVersion('1.2.3-dev.abc1234', 'minor')).toBe('1.3.0');
      expect(bumpVersion('1.2.3-dev.abc1234', 'major')).toBe('2.0.0');
    });

    test('handles zero versions', () => {
      expect(bumpVersion('0.0.0', 'patch')).toBe('0.0.1');
      expect(bumpVersion('0.0.0', 'minor')).toBe('0.1.0');
      expect(bumpVersion('0.0.0', 'major')).toBe('1.0.0');
    });

    test('throws for invalid version', () => {
      expect(() => bumpVersion('invalid', 'patch')).toThrow();
    });
  });

  describe('createDevVersion', () => {
    test('creates dev version with base36 timestamp', () => {
      const result = createDevVersion('1.2.3');
      // Should match pattern: 1.2.3-dev.<base36> (8 chars for ms timestamp)
      expect(result).toMatch(/^1\.2\.3-dev\.[a-z0-9]{8}$/);
    });

    test('creates dev version with custom suffix', () => {
      const result = createDevVersion('1.2.3', 'nightly');
      expect(result).toMatch(/^1\.2\.3-nightly\.[a-z0-9]{8}$/);
    });

    test('creates alpha version', () => {
      const result = createDevVersion('1.2.3', 'alpha');
      expect(result).toMatch(/^1\.2\.3-alpha\.[a-z0-9]{8}$/);
    });

    test('creates beta version', () => {
      const result = createDevVersion('1.2.3', 'beta');
      expect(result).toMatch(/^1\.2\.3-beta\.[a-z0-9]{8}$/);
    });

    test('creates rc version', () => {
      const result = createDevVersion('1.2.3', 'rc');
      expect(result).toMatch(/^1\.2\.3-rc\.[a-z0-9]{8}$/);
    });

    test('handles v prefix by stripping it', () => {
      const result = createDevVersion('v1.2.3');
      expect(result).toMatch(/^1\.2\.3-dev\.[a-z0-9]{8}$/);
    });

    test('timestamps sort correctly', async () => {
      const v1 = createDevVersion('1.2.3');
      // Wait 1ms to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1));
      const v2 = createDevVersion('1.2.3');
      // v2 should sort after v1 (lexicographically, base36 timestamps sort correctly)
      expect(v2 > v1).toBe(true);
    });
  });

  describe('getHighestBump', () => {
    test('returns major when major is present', () => {
      expect(getHighestBump(['patch', 'minor', 'major'])).toBe('major');
      expect(getHighestBump(['major'])).toBe('major');
      expect(getHighestBump(['major', 'major'])).toBe('major');
    });

    test('returns minor when minor is highest', () => {
      expect(getHighestBump(['patch', 'minor'])).toBe('minor');
      expect(getHighestBump(['minor'])).toBe('minor');
      expect(getHighestBump(['minor', 'patch', 'patch'])).toBe('minor');
    });

    test('returns patch when only patch is present', () => {
      expect(getHighestBump(['patch'])).toBe('patch');
      expect(getHighestBump(['patch', 'patch'])).toBe('patch');
    });

    test('returns default bump when empty', () => {
      expect(getHighestBump([])).toBe('patch');
      expect(getHighestBump([], 'minor')).toBe('minor');
    });

    test('handles mixed case', () => {
      // In real use, labels should be normalized before calling this
      expect(getHighestBump(['PATCH' as BumpType, 'minor'])).toBe('minor');
    });
  });

  describe('isPrerelease', () => {
    test('returns true for prerelease versions', () => {
      expect(isPrerelease('1.2.3-dev.abc1234')).toBe(true);
      expect(isPrerelease('1.2.3-alpha.1')).toBe(true);
      expect(isPrerelease('1.2.3-beta.2')).toBe(true);
      expect(isPrerelease('1.2.3-rc.1')).toBe(true);
      expect(isPrerelease('v1.2.3-dev.abc1234')).toBe(true);
    });

    test('returns false for stable versions', () => {
      expect(isPrerelease('1.2.3')).toBe(false);
      expect(isPrerelease('v1.2.3')).toBe(false);
      expect(isPrerelease('0.0.1')).toBe(false);
    });

    test('returns false for versions with only build metadata', () => {
      expect(isPrerelease('1.2.3+build.123')).toBe(false);
    });
  });

  describe('compareVersions', () => {
    test('compares major versions', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    test('compares minor versions', () => {
      expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
      expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
    });

    test('compares patch versions', () => {
      expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
      expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
    });

    test('handles v prefix', () => {
      expect(compareVersions('v2.0.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', 'v2.0.0')).toBe(-1);
      expect(compareVersions('v1.0.0', 'v1.0.0')).toBe(0);
    });

    test('stable versions are greater than prereleases', () => {
      expect(compareVersions('1.0.0', '1.0.0-dev.abc')).toBe(1);
      expect(compareVersions('1.0.0-dev.abc', '1.0.0')).toBe(-1);
    });

    test('compares prerelease versions', () => {
      expect(compareVersions('1.0.0-beta.1', '1.0.0-alpha.1')).toBe(1);
      expect(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.1')).toBe(1);
    });
  });
});
