/**
 * Tests for version file updates
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyVersionTemplate,
  getUpdatedFiles,
  parseVersionParts,
  updateVersionFile,
  updateVersionFiles,
} from '../../../src/core/version-files.js';
import { createTestProject, useTestDir } from '../../helpers/index.js';

describe('version-files', () => {
  const TEST_DIR = useTestDir('version-files-test');

  describe('parseVersionParts', () => {
    test('parses simple version', () => {
      const parts = parseVersionParts('1.2.3');
      expect(parts).toEqual({
        version: '1.2.3',
        major: '1',
        minor: '2',
        patch: '3',
      });
    });

    test('strips v prefix', () => {
      const parts = parseVersionParts('v1.2.3');
      expect(parts).toEqual({
        version: '1.2.3',
        major: '1',
        minor: '2',
        patch: '3',
      });
    });

    test('handles prerelease version', () => {
      const parts = parseVersionParts('1.2.3-dev.ml2fz8yd');
      expect(parts.version).toBe('1.2.3-dev.ml2fz8yd');
      expect(parts.major).toBe('1');
      expect(parts.minor).toBe('2');
      expect(parts.patch).toBe('3');
    });

    test('handles invalid version', () => {
      const parts = parseVersionParts('invalid');
      expect(parts).toEqual({
        version: 'invalid',
        major: '0',
        minor: '0',
        patch: '0',
      });
    });
  });

  describe('applyVersionTemplate', () => {
    const parts = { version: '1.2.3', major: '1', minor: '2', patch: '3' };

    test('replaces {version}', () => {
      const result = applyVersionTemplate('v{version}', parts);
      expect(result).toBe('v1.2.3');
    });

    test('replaces {major}', () => {
      const result = applyVersionTemplate('v{major}', parts);
      expect(result).toBe('v1');
    });

    test('replaces {minor}', () => {
      const result = applyVersionTemplate('{major}.{minor}', parts);
      expect(result).toBe('1.2');
    });

    test('replaces all placeholders', () => {
      const result = applyVersionTemplate('uses: org/action@v{version}', parts);
      expect(result).toBe('uses: org/action@v1.2.3');
    });

    test('replaces multiple occurrences', () => {
      const result = applyVersionTemplate('{version} and {version}', parts);
      expect(result).toBe('1.2.3 and 1.2.3');
    });
  });

  describe('updateVersionFile', () => {
    const defaultOptions = { cwd: TEST_DIR, dryRun: false, log: () => {} };

    test('updates version in file', () => {
      const project = createTestProject(TEST_DIR, 'update-test').withFile(
        'README.md',
        'uses: org/action@v1.0.0\nsome other content'
      );

      const result = updateVersionFile(
        {
          file: 'update-test/README.md',
          pattern: 'uses: org/action@v[0-9.]+',
          replace: 'uses: org/action@v{version}',
        },
        '2.0.0',
        defaultOptions
      );

      expect(result.updated).toBe(true);
      expect(result.matches).toBe(1);
      expect(result.error).toBeUndefined();

      const content = readFileSync(join(project.path, 'README.md'), 'utf-8');
      expect(content).toBe('uses: org/action@v2.0.0\nsome other content');
    });

    test('handles multiple matches', () => {
      const project = createTestProject(TEST_DIR, 'multi-match').withFile(
        'file.md',
        'v1.0.0 and v1.0.0 again'
      );

      const result = updateVersionFile(
        {
          file: 'multi-match/file.md',
          pattern: 'v[0-9.]+',
          replace: 'v{version}',
        },
        '2.0.0',
        defaultOptions
      );

      expect(result.updated).toBe(true);
      expect(result.matches).toBe(2);

      const content = readFileSync(join(project.path, 'file.md'), 'utf-8');
      expect(content).toBe('v2.0.0 and v2.0.0 again');
    });

    test('returns error for missing file', () => {
      const result = updateVersionFile(
        {
          file: 'nonexistent.md',
          pattern: 'v[0-9.]+',
          replace: 'v{version}',
        },
        '2.0.0',
        defaultOptions
      );

      expect(result.updated).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('returns error for pattern not found', () => {
      createTestProject(TEST_DIR, 'no-match').withFile('file.md', 'no version here');

      const result = updateVersionFile(
        {
          file: 'no-match/file.md',
          pattern: 'v[0-9.]+',
          replace: 'v{version}',
        },
        '2.0.0',
        defaultOptions
      );

      expect(result.updated).toBe(false);
      expect(result.error).toContain('Pattern not found');
    });

    test('dry run does not modify file', () => {
      const project = createTestProject(TEST_DIR, 'dry-run').withFile('file.md', 'v1.0.0');

      const logs: string[] = [];
      const result = updateVersionFile(
        {
          file: 'dry-run/file.md',
          pattern: 'v[0-9.]+',
          replace: 'v{version}',
        },
        '2.0.0',
        { cwd: TEST_DIR, dryRun: true, log: (msg) => logs.push(msg) }
      );

      expect(result.updated).toBe(true);
      expect(logs[0]).toContain('[dry-run]');

      const content = readFileSync(join(project.path, 'file.md'), 'utf-8');
      expect(content).toBe('v1.0.0'); // Unchanged
    });
  });

  describe('updateVersionFiles', () => {
    test('updates multiple files', () => {
      createTestProject(TEST_DIR, 'multi1').withFile('file.md', 'v1.0.0');
      createTestProject(TEST_DIR, 'multi2').withFile('file.md', 'version: 1.0.0');

      const results = updateVersionFiles(
        [
          { file: 'multi1/file.md', pattern: 'v[0-9.]+', replace: 'v{version}' },
          { file: 'multi2/file.md', pattern: 'version: [0-9.]+', replace: 'version: {version}' },
        ],
        '2.0.0',
        { cwd: TEST_DIR, dryRun: false, log: () => {} }
      );

      expect(results).toHaveLength(2);
      expect(results[0].updated).toBe(true);
      expect(results[1].updated).toBe(true);
    });
  });

  describe('getUpdatedFiles', () => {
    test('returns only updated files', () => {
      const results = [
        { file: 'a.md', updated: true, matches: 1 },
        { file: 'b.md', updated: false, matches: 0, error: 'not found' },
        { file: 'c.md', updated: true, matches: 2 },
      ];

      const files = getUpdatedFiles(results);
      expect(files).toEqual(['a.md', 'c.md']);
    });
  });
});
