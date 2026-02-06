/**
 * Tests for GitHub label parsing
 *
 * Handles extracting release bump types from PR labels.
 */

import { describe, expect, test } from 'bun:test';
import {
  extractReleaseLabels,
  getBumpTypeFromLabels,
  type LabelConfig,
  type PullRequest,
} from '../../../src/github/labels.js';

const defaultLabelConfig: LabelConfig = {
  major: 'release:major',
  minor: 'release:minor',
  patch: 'release:patch',
  skip: 'release:skip',
  alpha: 'release:alpha',
  beta: 'release:beta',
  rc: 'release:rc',
};

describe('GitHub labels', () => {
  describe('extractReleaseLabels', () => {
    test('extracts release labels from PRs', () => {
      const prs: PullRequest[] = [
        { number: 1, labels: ['bug', 'release:minor'] },
        { number: 2, labels: ['release:patch', 'docs'] },
        { number: 3, labels: ['enhancement'] },
      ];

      const labels = extractReleaseLabels(prs, defaultLabelConfig);

      expect(labels).toContain('release:minor');
      expect(labels).toContain('release:patch');
      expect(labels).not.toContain('bug');
      expect(labels).not.toContain('enhancement');
    });

    test('returns empty array when no release labels', () => {
      const prs: PullRequest[] = [
        { number: 1, labels: ['bug', 'docs'] },
        { number: 2, labels: ['enhancement'] },
      ];

      const labels = extractReleaseLabels(prs, defaultLabelConfig);

      expect(labels).toEqual([]);
    });

    test('handles PRs with no labels', () => {
      const prs: PullRequest[] = [
        { number: 1, labels: [] },
        { number: 2, labels: ['release:major'] },
      ];

      const labels = extractReleaseLabels(prs, defaultLabelConfig);

      expect(labels).toEqual(['release:major']);
    });

    test('handles empty PR list', () => {
      const labels = extractReleaseLabels([], defaultLabelConfig);
      expect(labels).toEqual([]);
    });

    test('works with custom label config', () => {
      const customConfig: LabelConfig = {
        major: 'breaking',
        minor: 'feature',
        patch: 'fix',
        skip: 'no-release',
        alpha: 'alpha',
        beta: 'beta',
        rc: 'rc',
      };

      const prs: PullRequest[] = [
        { number: 1, labels: ['breaking', 'urgent'] },
        { number: 2, labels: ['feature'] },
        { number: 3, labels: ['release:major'] }, // Should not match
      ];

      const labels = extractReleaseLabels(prs, customConfig);

      expect(labels).toContain('breaking');
      expect(labels).toContain('feature');
      expect(labels).not.toContain('release:major');
    });

    test('deduplicates labels', () => {
      const prs: PullRequest[] = [
        { number: 1, labels: ['release:minor'] },
        { number: 2, labels: ['release:minor'] },
        { number: 3, labels: ['release:minor', 'release:patch'] },
      ];

      const labels = extractReleaseLabels(prs, defaultLabelConfig);

      expect(labels.filter((l) => l === 'release:minor')).toHaveLength(1);
      expect(labels).toHaveLength(2);
    });

    test('includes skip label when all PRs have it', () => {
      const prs: PullRequest[] = [
        { number: 1, labels: ['release:skip', 'feature'] },
        { number: 2, labels: ['release:skip', 'bug'] },
        { number: 3, labels: ['release:skip'] },
      ];

      const labels = extractReleaseLabels(prs, defaultLabelConfig);

      expect(labels).toContain('release:skip');
    });

    test('includes skip label when single PR has it', () => {
      const prs: PullRequest[] = [{ number: 1, labels: ['release:skip', 'feature'] }];

      const labels = extractReleaseLabels(prs, defaultLabelConfig);

      expect(labels).toContain('release:skip');
    });

    test('excludes skip label when only some PRs have it', () => {
      const prs: PullRequest[] = [
        { number: 1, labels: ['release:skip', 'release:minor'] },
        { number: 2, labels: ['release:patch', 'docs'] },
        { number: 3, labels: ['release:skip'] },
      ];

      const labels = extractReleaseLabels(prs, defaultLabelConfig);

      expect(labels).not.toContain('release:skip');
      expect(labels).toContain('release:minor');
      expect(labels).toContain('release:patch');
    });

    test('excludes skip label when only one of many PRs has it', () => {
      const prs: PullRequest[] = [
        { number: 1, labels: ['release:skip'] },
        { number: 2, labels: ['release:minor'] },
        { number: 3, labels: ['enhancement'] },
        { number: 4, labels: ['bug'] },
      ];

      const labels = extractReleaseLabels(prs, defaultLabelConfig);

      expect(labels).not.toContain('release:skip');
      expect(labels).toContain('release:minor');
    });

    test('extracts prerelease labels', () => {
      const prs: PullRequest[] = [
        { number: 1, labels: ['release:minor', 'release:rc'] },
        { number: 2, labels: ['release:alpha'] },
      ];

      const labels = extractReleaseLabels(prs, defaultLabelConfig);

      expect(labels).toContain('release:minor');
      expect(labels).toContain('release:rc');
      expect(labels).toContain('release:alpha');
    });
  });

  describe('getBumpTypeFromLabels', () => {
    test('returns major when major label present', () => {
      const labels = ['release:patch', 'release:minor', 'release:major'];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.bumpType).toBe('major');
      expect(result.skip).toBe(false);
      expect(result.prerelease).toBeNull();
    });

    test('returns minor when minor is highest', () => {
      const labels = ['release:patch', 'release:minor'];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.bumpType).toBe('minor');
      expect(result.skip).toBe(false);
    });

    test('returns patch when only patch', () => {
      const labels = ['release:patch'];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.bumpType).toBe('patch');
      expect(result.skip).toBe(false);
    });

    test('returns null with skip flag when skip label present', () => {
      const labels = ['release:skip', 'release:major'];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.bumpType).toBeNull();
      expect(result.skip).toBe(true);
      expect(result.prerelease).toBeNull();
    });

    test('returns null when no release labels', () => {
      const labels: string[] = [];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.bumpType).toBeNull();
      expect(result.skip).toBe(false);
      expect(result.prerelease).toBeNull();
    });

    test('works with custom label config', () => {
      const customConfig: LabelConfig = {
        major: 'breaking-change',
        minor: 'new-feature',
        patch: 'bugfix',
        skip: 'skip-release',
        alpha: 'prerelease-alpha',
        beta: 'prerelease-beta',
        rc: 'prerelease-rc',
      };

      const labels = ['new-feature', 'bugfix'];
      const result = getBumpTypeFromLabels(labels, customConfig);

      expect(result.bumpType).toBe('minor');
    });

    test('handles case sensitivity', () => {
      const labels = ['Release:Major']; // Different case
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      // Labels should be case-sensitive by default
      expect(result.bumpType).toBeNull();
    });

    test('detects alpha prerelease', () => {
      const labels = ['release:minor', 'release:alpha'];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.bumpType).toBe('minor');
      expect(result.prerelease).toBe('alpha');
    });

    test('detects beta prerelease', () => {
      const labels = ['release:patch', 'release:beta'];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.bumpType).toBe('patch');
      expect(result.prerelease).toBe('beta');
    });

    test('detects rc prerelease', () => {
      const labels = ['release:major', 'release:rc'];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.bumpType).toBe('major');
      expect(result.prerelease).toBe('rc');
    });

    test('rc takes priority over beta and alpha', () => {
      const labels = ['release:minor', 'release:alpha', 'release:beta', 'release:rc'];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.prerelease).toBe('rc');
    });

    test('beta takes priority over alpha', () => {
      const labels = ['release:minor', 'release:alpha', 'release:beta'];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.prerelease).toBe('beta');
    });

    test('prerelease works without bump type label', () => {
      const labels = ['release:rc'];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.bumpType).toBeNull();
      expect(result.prerelease).toBe('rc');
    });
  });
});
