/**
 * Tests for Custom ecosystem implementation
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CustomEcosystem, type CustomEcosystemContext } from '../../../src/ecosystems/custom.js';
import { createTestProject, useTestDir } from '../../helpers/index.js';

/** Create a CustomEcosystemContext for testing */
function createCustomContext(
  path: string,
  options: Partial<CustomEcosystemContext> = {}
): CustomEcosystemContext {
  return {
    path,
    dryRun: false,
    log: () => {},
    ...options,
  };
}

describe('CustomEcosystem', () => {
  const custom = new CustomEcosystem();
  const TEST_DIR = useTestDir('custom-test');

  describe('properties', () => {
    test('has correct name', () => {
      expect(custom.name).toBe('custom');
    });
  });

  describe('detect', () => {
    test('always returns true', async () => {
      const project = createTestProject(TEST_DIR, 'detect-test');
      expect(await custom.detect(project.path)).toBe(true);
    });

    test('returns true even for non-existent directory', async () => {
      expect(await custom.detect('/non/existent/path')).toBe(true);
    });
  });

  describe('readVersion', () => {
    test('reads version from VERSION file', async () => {
      const project = createTestProject(TEST_DIR, 'read-version').withVersionFile('1.2.3');

      const version = await custom.readVersion(createCustomContext(project.path));
      expect(version).toBe('1.2.3');
    });

    test('reads version with v prefix', async () => {
      const project = createTestProject(TEST_DIR, 'read-v-version').withVersionFile('v1.2.3');

      const version = await custom.readVersion(createCustomContext(project.path));
      expect(version).toBe('1.2.3');
    });

    test('reads version from custom file', async () => {
      const project = createTestProject(TEST_DIR, 'read-custom').withVersionFile(
        '2.0.0',
        'version.txt'
      );

      const version = await custom.readVersion(
        createCustomContext(project.path, { versionFile: 'version.txt' })
      );
      expect(version).toBe('2.0.0');
    });

    test('extracts version from complex content', async () => {
      const project = createTestProject(TEST_DIR, 'read-complex').withFile(
        'VERSION',
        'version = "3.1.4"'
      );

      const version = await custom.readVersion(createCustomContext(project.path));
      expect(version).toBe('3.1.4');
    });

    test('reads prerelease version', async () => {
      const project = createTestProject(TEST_DIR, 'read-prerelease').withVersionFile(
        '1.0.0-beta.1'
      );

      const version = await custom.readVersion(createCustomContext(project.path));
      expect(version).toBe('1.0.0-beta.1');
    });

    test('returns 0.0.0 when file not found', async () => {
      const project = createTestProject(TEST_DIR, 'no-file');

      const version = await custom.readVersion(createCustomContext(project.path));
      expect(version).toBe('0.0.0');
    });

    test('returns 0.0.0 when version cannot be parsed', async () => {
      const project = createTestProject(TEST_DIR, 'bad-version').withFile(
        'VERSION',
        'not-a-version'
      );

      const version = await custom.readVersion(createCustomContext(project.path));
      expect(version).toBe('0.0.0');
    });
  });

  describe('writeVersion', () => {
    test('writes version to VERSION file', async () => {
      const project = createTestProject(TEST_DIR, 'write-version').withVersionFile('1.0.0');

      await custom.writeVersion(createCustomContext(project.path), '2.0.0');

      const content = readFileSync(join(project.path, 'VERSION'), 'utf-8');
      expect(content).toContain('2.0.0');
    });

    test('writes version to custom file', async () => {
      const project = createTestProject(TEST_DIR, 'write-custom').withVersionFile(
        '1.0.0',
        'version.txt'
      );

      await custom.writeVersion(
        createCustomContext(project.path, { versionFile: 'version.txt' }),
        '2.0.0'
      );

      const content = readFileSync(join(project.path, 'version.txt'), 'utf-8');
      expect(content).toContain('2.0.0');
    });

    test('creates new file if not exists', async () => {
      const project = createTestProject(TEST_DIR, 'write-new');

      await custom.writeVersion(createCustomContext(project.path), '1.0.0');

      const content = readFileSync(join(project.path, 'VERSION'), 'utf-8');
      expect(content).toBe('1.0.0\n');
    });

    test('replaces version in complex content', async () => {
      const project = createTestProject(TEST_DIR, 'write-complex').withFile(
        'VERSION',
        'version = "1.0.0"'
      );

      await custom.writeVersion(createCustomContext(project.path), '2.0.0');

      const content = readFileSync(join(project.path, 'VERSION'), 'utf-8');
      expect(content).toBe('version = "2.0.0"');
    });

    test('skips write in dry run mode', async () => {
      const project = createTestProject(TEST_DIR, 'dry-run').withVersionFile('1.0.0');

      await custom.writeVersion(createCustomContext(project.path, { dryRun: true }), '2.0.0');

      const content = readFileSync(join(project.path, 'VERSION'), 'utf-8');
      expect(content).toBe('1.0.0\n');
    });
  });

  describe('getVersionFiles', () => {
    test('returns VERSION by default', async () => {
      const project = createTestProject(TEST_DIR, 'version-files');

      const files = await custom.getVersionFiles(createCustomContext(project.path));
      expect(files).toContain('VERSION');
    });

    test('returns custom versionFile', async () => {
      const project = createTestProject(TEST_DIR, 'custom-version-files');

      const files = await custom.getVersionFiles(
        createCustomContext(project.path, { versionFile: 'version.txt' })
      );
      expect(files).toContain('version.txt');
    });
  });

  describe('publish', () => {
    test('does nothing when no publishCommand', async () => {
      const project = createTestProject(TEST_DIR, 'no-publish');

      // Should not throw
      await custom.publish(createCustomContext(project.path));
    });

    test('skips in dry run mode', async () => {
      const project = createTestProject(TEST_DIR, 'publish-dry-run');

      // Should not throw or execute command
      await custom.publish(
        createCustomContext(project.path, {
          dryRun: true,
          publishCommand: 'echo "publishing"',
          publishArgs: ['--flag'],
        })
      );
    });
  });
});
