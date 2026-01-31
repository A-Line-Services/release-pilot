/**
 * Tests for GitHub label parsing
 *
 * Handles extracting release bump types from PR labels.
 */

import { describe, test, expect } from 'bun:test';
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

    test('detects skip label', () => {
      const prs: PullRequest[] = [{ number: 1, labels: ['release:skip', 'feature'] }];

      const labels = extractReleaseLabels(prs, defaultLabelConfig);

      expect(labels).toContain('release:skip');
    });
  });

  describe('getBumpTypeFromLabels', () => {
    test('returns major when major label present', () => {
      const labels = ['release:patch', 'release:minor', 'release:major'];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.bumpType).toBe('major');
      expect(result.skip).toBe(false);
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
    });

    test('returns null when no release labels', () => {
      const labels: string[] = [];
      const result = getBumpTypeFromLabels(labels, defaultLabelConfig);

      expect(result.bumpType).toBeNull();
      expect(result.skip).toBe(false);
    });

    test('works with custom label config', () => {
      const customConfig: LabelConfig = {
        major: 'breaking-change',
        minor: 'new-feature',
        patch: 'bugfix',
        skip: 'skip-release',
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
  });
});
