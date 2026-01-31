/**
 * Tests for git operations
 *
 * Note: Most git operations require a real git repository,
 * so these tests focus on the utility functions and mock exec calls.
 */

import { describe, test, expect } from 'bun:test';
import { formatCommitMessage, formatTag, parseTagVersion } from '../../../src/core/git.js';

describe('git utilities', () => {
  describe('formatCommitMessage', () => {
    test('replaces {version} placeholder', () => {
      const message = formatCommitMessage('chore(release): {version}', '1.2.3');
      expect(message).toBe('chore(release): 1.2.3');
    });

    test('replaces multiple placeholders', () => {
      const message = formatCommitMessage('release {version} - v{version}', '2.0.0');
      expect(message).toBe('release 2.0.0 - v2.0.0');
    });

    test('handles message without placeholders', () => {
      const message = formatCommitMessage('release new version', '1.0.0');
      expect(message).toBe('release new version');
    });

    test('handles empty version', () => {
      const message = formatCommitMessage('version: {version}', '');
      expect(message).toBe('version: ');
    });
  });

  describe('formatTag', () => {
    test('adds prefix to version', () => {
      expect(formatTag('v', '1.2.3')).toBe('v1.2.3');
    });

    test('handles empty prefix', () => {
      expect(formatTag('', '1.2.3')).toBe('1.2.3');
    });

    test('handles custom prefix', () => {
      expect(formatTag('release-', '1.2.3')).toBe('release-1.2.3');
    });

    test('does not duplicate prefix if version already has it', () => {
      expect(formatTag('v', 'v1.2.3')).toBe('v1.2.3');
    });
  });

  describe('parseTagVersion', () => {
    test('extracts version from v-prefixed tag', () => {
      expect(parseTagVersion('v1.2.3', 'v')).toBe('1.2.3');
    });

    test('extracts version from tag without prefix', () => {
      expect(parseTagVersion('1.2.3', '')).toBe('1.2.3');
    });

    test('extracts version with custom prefix', () => {
      expect(parseTagVersion('release-1.2.3', 'release-')).toBe('1.2.3');
    });

    test('handles prerelease versions', () => {
      expect(parseTagVersion('v1.2.3-dev.abc1234', 'v')).toBe('1.2.3-dev.abc1234');
    });

    test('returns full tag if prefix does not match', () => {
      expect(parseTagVersion('1.2.3', 'v')).toBe('1.2.3');
    });
  });
});
