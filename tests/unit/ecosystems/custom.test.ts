/**
 * Tests for Custom ecosystem implementation
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CustomEcosystem, type CustomEcosystemContext } from '../../../src/ecosystems/custom.js';

const TEST_DIR = join(import.meta.dir, '../../fixtures/custom-test');

function createContext(
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

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('properties', () => {
    test('has correct name', () => {
      expect(custom.name).toBe('custom');
    });
  });

  describe('detect', () => {
    test('always returns true', async () => {
      const projectDir = join(TEST_DIR, 'detect-test');
      mkdirSync(projectDir, { recursive: true });

      expect(await custom.detect(projectDir)).toBe(true);
    });

    test('returns true even for non-existent directory', async () => {
      expect(await custom.detect('/non/existent/path')).toBe(true);
    });
  });

  describe('readVersion', () => {
    test('reads version from VERSION file', async () => {
      const projectDir = join(TEST_DIR, 'read-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'VERSION'), '1.2.3\n');

      const version = await custom.readVersion(createContext(projectDir));

      expect(version).toBe('1.2.3');
    });

    test('reads version with v prefix', async () => {
      const projectDir = join(TEST_DIR, 'read-v-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'VERSION'), 'v1.2.3\n');

      const version = await custom.readVersion(createContext(projectDir));

      expect(version).toBe('1.2.3');
    });

    test('reads version from custom file', async () => {
      const projectDir = join(TEST_DIR, 'read-custom');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'version.txt'), '2.0.0\n');

      const version = await custom.readVersion(
        createContext(projectDir, { versionFile: 'version.txt' })
      );

      expect(version).toBe('2.0.0');
    });

    test('extracts version from complex content', async () => {
      const projectDir = join(TEST_DIR, 'read-complex');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'VERSION'), 'version = "3.1.4"');

      const version = await custom.readVersion(createContext(projectDir));

      expect(version).toBe('3.1.4');
    });

    test('reads prerelease version', async () => {
      const projectDir = join(TEST_DIR, 'read-prerelease');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'VERSION'), '1.0.0-beta.1');

      const version = await custom.readVersion(createContext(projectDir));

      expect(version).toBe('1.0.0-beta.1');
    });

    test('returns 0.0.0 when file not found', async () => {
      const projectDir = join(TEST_DIR, 'no-file');
      mkdirSync(projectDir, { recursive: true });

      const version = await custom.readVersion(createContext(projectDir));

      expect(version).toBe('0.0.0');
    });

    test('returns 0.0.0 when version cannot be parsed', async () => {
      const projectDir = join(TEST_DIR, 'bad-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'VERSION'), 'not-a-version');

      const version = await custom.readVersion(createContext(projectDir));

      expect(version).toBe('0.0.0');
    });
  });

  describe('writeVersion', () => {
    test('writes version to VERSION file', async () => {
      const projectDir = join(TEST_DIR, 'write-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'VERSION'), '1.0.0\n');

      await custom.writeVersion(createContext(projectDir), '2.0.0');

      const content = readFileSync(join(projectDir, 'VERSION'), 'utf-8');
      expect(content).toContain('2.0.0');
    });

    test('writes version to custom file', async () => {
      const projectDir = join(TEST_DIR, 'write-custom');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'version.txt'), '1.0.0\n');

      await custom.writeVersion(createContext(projectDir, { versionFile: 'version.txt' }), '2.0.0');

      const content = readFileSync(join(projectDir, 'version.txt'), 'utf-8');
      expect(content).toContain('2.0.0');
    });

    test('creates new file if not exists', async () => {
      const projectDir = join(TEST_DIR, 'write-new');
      mkdirSync(projectDir, { recursive: true });

      await custom.writeVersion(createContext(projectDir), '1.0.0');

      const content = readFileSync(join(projectDir, 'VERSION'), 'utf-8');
      expect(content).toBe('1.0.0\n');
    });

    test('replaces version in complex content', async () => {
      const projectDir = join(TEST_DIR, 'write-complex');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'VERSION'), 'version = "1.0.0"');

      await custom.writeVersion(createContext(projectDir), '2.0.0');

      const content = readFileSync(join(projectDir, 'VERSION'), 'utf-8');
      expect(content).toBe('version = "2.0.0"');
    });

    test('skips write in dry run mode', async () => {
      const projectDir = join(TEST_DIR, 'dry-run');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'VERSION'), '1.0.0\n');

      await custom.writeVersion(createContext(projectDir, { dryRun: true }), '2.0.0');

      const content = readFileSync(join(projectDir, 'VERSION'), 'utf-8');
      expect(content).toBe('1.0.0\n');
    });
  });

  describe('getVersionFiles', () => {
    test('returns VERSION by default', async () => {
      const projectDir = join(TEST_DIR, 'version-files');
      mkdirSync(projectDir, { recursive: true });

      const files = await custom.getVersionFiles(createContext(projectDir));

      expect(files).toContain('VERSION');
    });

    test('returns custom versionFile', async () => {
      const projectDir = join(TEST_DIR, 'custom-version-files');
      mkdirSync(projectDir, { recursive: true });

      const files = await custom.getVersionFiles(
        createContext(projectDir, { versionFile: 'version.txt' })
      );

      expect(files).toContain('version.txt');
    });
  });

  describe('publish', () => {
    test('does nothing when no publishCommand', async () => {
      const projectDir = join(TEST_DIR, 'no-publish');
      mkdirSync(projectDir, { recursive: true });

      // Should not throw
      await custom.publish(createContext(projectDir));
    });

    test('skips in dry run mode', async () => {
      const projectDir = join(TEST_DIR, 'publish-dry-run');
      mkdirSync(projectDir, { recursive: true });

      // Should not throw or execute command
      await custom.publish(
        createContext(projectDir, {
          dryRun: true,
          publishCommand: 'echo "publishing"',
          publishArgs: ['--flag'],
        })
      );
    });
  });
});
