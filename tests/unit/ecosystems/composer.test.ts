/**
 * Tests for Composer (PHP) ecosystem implementation
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EcosystemContext } from '../../../src/ecosystems/base.js';
import { ComposerEcosystem } from '../../../src/ecosystems/composer.js';

const TEST_DIR = join(import.meta.dir, '../../fixtures/composer-test');

function createContext(path: string, options: Partial<EcosystemContext> = {}): EcosystemContext {
  return {
    path,
    dryRun: false,
    log: () => {},
    ...options,
  };
}

describe('ComposerEcosystem', () => {
  const composer = new ComposerEcosystem();

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('properties', () => {
    test('has correct name', () => {
      expect(composer.name).toBe('composer');
    });
  });

  describe('detect', () => {
    test('detects composer.json', async () => {
      const projectDir = join(TEST_DIR, 'detect-test');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'composer.json'), '{}');

      expect(await composer.detect(projectDir)).toBe(true);
    });

    test('returns false when no composer.json', async () => {
      const emptyDir = join(TEST_DIR, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      expect(await composer.detect(emptyDir)).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('reads version from composer.json', async () => {
      const projectDir = join(TEST_DIR, 'read-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'composer.json'),
        JSON.stringify({ name: 'vendor/test', version: '1.2.3' })
      );

      const version = await composer.readVersion(createContext(projectDir));

      expect(version).toBe('1.2.3');
    });

    test('throws when version is missing', async () => {
      const projectDir = join(TEST_DIR, 'no-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'composer.json'), JSON.stringify({ name: 'vendor/test' }));

      await expect(composer.readVersion(createContext(projectDir))).rejects.toThrow();
    });

    test('throws when composer.json is missing', async () => {
      const emptyDir = join(TEST_DIR, 'no-composer');
      mkdirSync(emptyDir, { recursive: true });

      await expect(composer.readVersion(createContext(emptyDir))).rejects.toThrow();
    });
  });

  describe('writeVersion', () => {
    test('writes version to composer.json', async () => {
      const projectDir = join(TEST_DIR, 'write-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'composer.json'),
        JSON.stringify({ name: 'vendor/test', version: '1.0.0' }, null, 4)
      );

      await composer.writeVersion(createContext(projectDir), '2.0.0');

      const content = JSON.parse(readFileSync(join(projectDir, 'composer.json'), 'utf-8'));
      expect(content.version).toBe('2.0.0');
    });

    test('preserves other composer.json fields', async () => {
      const projectDir = join(TEST_DIR, 'preserve-fields');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'composer.json'),
        JSON.stringify(
          {
            name: 'vendor/test',
            version: '1.0.0',
            description: 'A test package',
            require: { php: '>=8.0' },
          },
          null,
          4
        )
      );

      await composer.writeVersion(createContext(projectDir), '1.1.0');

      const content = JSON.parse(readFileSync(join(projectDir, 'composer.json'), 'utf-8'));
      expect(content.version).toBe('1.1.0');
      expect(content.name).toBe('vendor/test');
      expect(content.description).toBe('A test package');
      expect(content.require.php).toBe('>=8.0');
    });

    test('preserves formatting (4-space indent)', async () => {
      const projectDir = join(TEST_DIR, 'preserve-format');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'composer.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' }, null, 4)
      );

      await composer.writeVersion(createContext(projectDir), '1.1.0');

      const content = readFileSync(join(projectDir, 'composer.json'), 'utf-8');
      expect(content).toContain('    "name"'); // 4-space indent preserved
    });

    test('skips write in dry run mode', async () => {
      const projectDir = join(TEST_DIR, 'dry-run');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'composer.json'),
        JSON.stringify({ name: 'vendor/test', version: '1.0.0' })
      );

      await composer.writeVersion(createContext(projectDir, { dryRun: true }), '2.0.0');

      const content = JSON.parse(readFileSync(join(projectDir, 'composer.json'), 'utf-8'));
      expect(content.version).toBe('1.0.0'); // Not changed
    });
  });

  describe('getVersionFiles', () => {
    test('returns composer.json', async () => {
      const projectDir = join(TEST_DIR, 'version-files');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'composer.json'), '{}');

      const files = await composer.getVersionFiles(createContext(projectDir));

      expect(files).toContain('composer.json');
    });

    test('includes composer.lock if exists', async () => {
      const projectDir = join(TEST_DIR, 'with-lock');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'composer.json'), '{}');
      writeFileSync(join(projectDir, 'composer.lock'), '{}');

      const files = await composer.getVersionFiles(createContext(projectDir));

      expect(files).toContain('composer.json');
      expect(files).toContain('composer.lock');
    });
  });
});
