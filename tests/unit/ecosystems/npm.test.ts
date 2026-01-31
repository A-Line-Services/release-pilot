/**
 * Tests for npm ecosystem implementation
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EcosystemContext } from '../../../src/ecosystems/base.js';
import { NpmEcosystem } from '../../../src/ecosystems/npm.js';

const TEST_DIR = join(import.meta.dir, '../../fixtures/npm-test');

function createContext(path: string, options: Partial<EcosystemContext> = {}): EcosystemContext {
  return {
    path,
    dryRun: false,
    log: () => {},
    ...options,
  };
}

describe('NpmEcosystem', () => {
  const npm = new NpmEcosystem();

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('properties', () => {
    test('has correct name', () => {
      expect(npm.name).toBe('npm');
    });
  });

  describe('detect', () => {
    test('detects package.json', async () => {
      const projectDir = join(TEST_DIR, 'detect-test');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'package.json'), '{}');

      expect(await npm.detect(projectDir)).toBe(true);
    });

    test('returns false when no package.json', async () => {
      const emptyDir = join(TEST_DIR, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      expect(await npm.detect(emptyDir)).toBe(false);
    });

    test('returns false for non-existent directory', async () => {
      expect(await npm.detect('/non/existent/path')).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('reads version from package.json', async () => {
      const projectDir = join(TEST_DIR, 'read-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.2.3' })
      );

      const version = await npm.readVersion(createContext(projectDir));

      expect(version).toBe('1.2.3');
    });

    test('throws when version is missing', async () => {
      const projectDir = join(TEST_DIR, 'no-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ name: 'test' }));

      await expect(npm.readVersion(createContext(projectDir))).rejects.toThrow();
    });

    test('throws when package.json is missing', async () => {
      const emptyDir = join(TEST_DIR, 'no-pkg');
      mkdirSync(emptyDir, { recursive: true });

      await expect(npm.readVersion(createContext(emptyDir))).rejects.toThrow();
    });

    test('uses custom versionFile', async () => {
      const projectDir = join(TEST_DIR, 'custom-file');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'custom.json'),
        JSON.stringify({ name: 'test', version: '2.0.0' })
      );

      const version = await npm.readVersion(
        createContext(projectDir, { versionFile: 'custom.json' })
      );

      expect(version).toBe('2.0.0');
    });
  });

  describe('writeVersion', () => {
    test('writes version to package.json', async () => {
      const projectDir = join(TEST_DIR, 'write-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2)
      );

      await npm.writeVersion(createContext(projectDir), '2.0.0');

      const content = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
      expect(content.version).toBe('2.0.0');
    });

    test('preserves other package.json fields', async () => {
      const projectDir = join(TEST_DIR, 'preserve-fields');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test',
            version: '1.0.0',
            description: 'A test package',
            dependencies: { lodash: '^4.0.0' },
          },
          null,
          2
        )
      );

      await npm.writeVersion(createContext(projectDir), '1.1.0');

      const content = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
      expect(content.version).toBe('1.1.0');
      expect(content.name).toBe('test');
      expect(content.description).toBe('A test package');
      expect(content.dependencies.lodash).toBe('^4.0.0');
    });

    test('preserves formatting (2-space indent)', async () => {
      const projectDir = join(TEST_DIR, 'preserve-format');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2)
      );

      await npm.writeVersion(createContext(projectDir), '1.1.0');

      const content = readFileSync(join(projectDir, 'package.json'), 'utf-8');
      expect(content).toContain('  "name"'); // 2-space indent preserved
    });

    test('skips write in dry run mode', async () => {
      const projectDir = join(TEST_DIR, 'dry-run');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' })
      );

      await npm.writeVersion(createContext(projectDir, { dryRun: true }), '2.0.0');

      const content = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
      expect(content.version).toBe('1.0.0'); // Not changed
    });
  });

  describe('getVersionFiles', () => {
    test('returns package.json', async () => {
      const projectDir = join(TEST_DIR, 'version-files');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'package.json'), '{}');

      const files = await npm.getVersionFiles(createContext(projectDir));

      expect(files).toContain('package.json');
    });

    test('includes package-lock.json if exists', async () => {
      const projectDir = join(TEST_DIR, 'with-lock');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'package.json'), '{}');
      writeFileSync(join(projectDir, 'package-lock.json'), '{}');

      const files = await npm.getVersionFiles(createContext(projectDir));

      expect(files).toContain('package.json');
      expect(files).toContain('package-lock.json');
    });

    test('includes npm-shrinkwrap.json if exists', async () => {
      const projectDir = join(TEST_DIR, 'with-shrinkwrap');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'package.json'), '{}');
      writeFileSync(join(projectDir, 'npm-shrinkwrap.json'), '{}');

      const files = await npm.getVersionFiles(createContext(projectDir));

      expect(files).toContain('npm-shrinkwrap.json');
    });
  });
});
