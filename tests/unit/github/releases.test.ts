/**
 * Tests for GitHub release utilities
 *
 * Handles finding releases and PRs since last release.
 */

import { describe, test, expect } from 'bun:test';
import {
  findLastStableRelease,
  filterPRsSinceDate,
  type Release,
  type PullRequestWithMergeInfo,
} from '../../../src/github/releases.js';

describe('GitHub releases', () => {
  describe('findLastStableRelease', () => {
    test('finds last stable release', () => {
      const releases: Release[] = [
        { tagName: 'v1.3.0-dev.abc1234', publishedAt: '2024-01-20T00:00:00Z', prerelease: true },
        { tagName: 'v1.2.0', publishedAt: '2024-01-15T00:00:00Z', prerelease: false },
        { tagName: 'v1.1.0', publishedAt: '2024-01-10T00:00:00Z', prerelease: false },
      ];

      const stable = findLastStableRelease(releases);

      expect(stable?.tagName).toBe('v1.2.0');
      expect(stable?.prerelease).toBe(false);
    });

    test('skips all prereleases', () => {
      const releases: Release[] = [
        { tagName: 'v1.3.0-dev.abc', publishedAt: '2024-01-20T00:00:00Z', prerelease: true },
        { tagName: 'v1.3.0-beta.1', publishedAt: '2024-01-18T00:00:00Z', prerelease: true },
        { tagName: 'v1.2.0', publishedAt: '2024-01-15T00:00:00Z', prerelease: false },
      ];

      const stable = findLastStableRelease(releases);

      expect(stable?.tagName).toBe('v1.2.0');
    });

    test('returns null when no stable releases', () => {
      const releases: Release[] = [
        { tagName: 'v1.0.0-dev.abc', publishedAt: '2024-01-20T00:00:00Z', prerelease: true },
        { tagName: 'v1.0.0-beta.1', publishedAt: '2024-01-18T00:00:00Z', prerelease: true },
      ];

      const stable = findLastStableRelease(releases);

      expect(stable).toBeNull();
    });

    test('returns null for empty release list', () => {
      const stable = findLastStableRelease([]);
      expect(stable).toBeNull();
    });

    test('handles releases without prerelease flag by checking tag', () => {
      const releases: Release[] = [
        // Some APIs might not set prerelease flag, so we also check the tag
        { tagName: 'v1.0.0-rc.1', publishedAt: '2024-01-20T00:00:00Z', prerelease: false },
        { tagName: 'v0.9.0', publishedAt: '2024-01-15T00:00:00Z', prerelease: false },
      ];

      const stable = findLastStableRelease(releases);

      // Even if prerelease flag is false, -rc in tag should be treated as prerelease
      expect(stable?.tagName).toBe('v0.9.0');
    });

    test('uses custom prerelease pattern', () => {
      const releases: Release[] = [
        { tagName: 'v1.0.0-custom.1', publishedAt: '2024-01-20T00:00:00Z', prerelease: false },
        { tagName: 'v0.9.0', publishedAt: '2024-01-15T00:00:00Z', prerelease: false },
      ];

      const stable = findLastStableRelease(releases, '-custom');

      expect(stable?.tagName).toBe('v0.9.0');
    });
  });

  describe('filterPRsSinceDate', () => {
    const basePRs: PullRequestWithMergeInfo[] = [
      { number: 5, mergedAt: '2024-01-25T00:00:00Z', labels: ['feature'] },
      { number: 4, mergedAt: '2024-01-20T00:00:00Z', labels: ['release:minor'] },
      { number: 3, mergedAt: '2024-01-15T00:00:00Z', labels: ['bugfix'] },
      { number: 2, mergedAt: '2024-01-10T00:00:00Z', labels: ['docs'] },
      { number: 1, mergedAt: '2024-01-05T00:00:00Z', labels: ['release:patch'] },
    ];

    test('filters PRs merged after date', () => {
      const sinceDate = '2024-01-15T00:00:00Z';
      const filtered = filterPRsSinceDate(basePRs, sinceDate);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((pr) => pr.number)).toEqual([5, 4]);
    });

    test('returns all PRs when date is very old', () => {
      const sinceDate = '2020-01-01T00:00:00Z';
      const filtered = filterPRsSinceDate(basePRs, sinceDate);

      expect(filtered).toHaveLength(5);
    });

    test('returns no PRs when date is in future', () => {
      const sinceDate = '2030-01-01T00:00:00Z';
      const filtered = filterPRsSinceDate(basePRs, sinceDate);

      expect(filtered).toHaveLength(0);
    });

    test('handles empty PR list', () => {
      const filtered = filterPRsSinceDate([], '2024-01-01T00:00:00Z');
      expect(filtered).toHaveLength(0);
    });

    test('excludes PRs merged exactly at the date', () => {
      // PRs merged exactly at the release date should be excluded
      // (they were already in the previous release)
      const sinceDate = '2024-01-15T00:00:00Z';
      const filtered = filterPRsSinceDate(basePRs, sinceDate);

      expect(filtered.some((pr) => pr.number === 3)).toBe(false);
    });

    test('handles PRs without mergedAt', () => {
      const prsWithNulls: PullRequestWithMergeInfo[] = [
        { number: 2, mergedAt: '2024-01-20T00:00:00Z', labels: [] },
        { number: 1, mergedAt: null as unknown as string, labels: [] },
      ];

      const filtered = filterPRsSinceDate(prsWithNulls, '2024-01-10T00:00:00Z');

      // PRs without mergedAt should be excluded
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.number).toBe(2);
    });
  });
});
