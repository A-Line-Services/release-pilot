/**
 * Tests for Composer (PHP) ecosystem implementation
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComposerEcosystem } from '../../../src/ecosystems/composer.js';
import { createContext, createTestProject, useTestDir } from '../../helpers/index.js';

describe('ComposerEcosystem', () => {
  const composer = new ComposerEcosystem();
  const TEST_DIR = useTestDir('composer-test');

  describe('properties', () => {
    test('has correct name', () => {
      expect(composer.name).toBe('composer');
    });
  });

  describe('detect', () => {
    test('detects composer.json', async () => {
      const project = createTestProject(TEST_DIR, 'detect-test').withComposerJson();
      expect(await composer.detect(project.path)).toBe(true);
    });

    test('returns false when no composer.json', async () => {
      const project = createTestProject(TEST_DIR, 'empty');
      expect(await composer.detect(project.path)).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('reads version from composer.json', async () => {
      const project = createTestProject(TEST_DIR, 'read-version').withComposerJson({
        version: '1.2.3',
      });

      const version = await composer.readVersion(createContext(project.path));
      expect(version).toBe('1.2.3');
    });

    test('throws when version is missing', async () => {
      const project = createTestProject(TEST_DIR, 'no-version').withJson('composer.json', {
        name: 'vendor/test',
      });

      await expect(composer.readVersion(createContext(project.path))).rejects.toThrow();
    });

    test('throws when composer.json is missing', async () => {
      const project = createTestProject(TEST_DIR, 'no-composer');
      await expect(composer.readVersion(createContext(project.path))).rejects.toThrow();
    });
  });

  describe('writeVersion', () => {
    test('writes version to composer.json', async () => {
      const project = createTestProject(TEST_DIR, 'write-version').withComposerJson({
        version: '1.0.0',
      });

      await composer.writeVersion(createContext(project.path), '2.0.0');

      const content = JSON.parse(readFileSync(join(project.path, 'composer.json'), 'utf-8'));
      expect(content.version).toBe('2.0.0');
    });

    test('preserves other composer.json fields', async () => {
      const project = createTestProject(TEST_DIR, 'preserve-fields').withComposerJson({
        version: '1.0.0',
        description: 'A test package',
        require: { php: '>=8.0' },
      });

      await composer.writeVersion(createContext(project.path), '1.1.0');

      const content = JSON.parse(readFileSync(join(project.path, 'composer.json'), 'utf-8'));
      expect(content.version).toBe('1.1.0');
      expect(content.name).toBe('vendor/test');
      expect(content.description).toBe('A test package');
      expect(content.require.php).toBe('>=8.0');
    });

    test('preserves formatting (4-space indent)', async () => {
      const project = createTestProject(TEST_DIR, 'preserve-format').withComposerJson({
        version: '1.0.0',
      });

      await composer.writeVersion(createContext(project.path), '1.1.0');

      const content = readFileSync(join(project.path, 'composer.json'), 'utf-8');
      expect(content).toContain('    "name"'); // 4-space indent preserved
    });

    test('skips write in dry run mode', async () => {
      const project = createTestProject(TEST_DIR, 'dry-run').withComposerJson({
        version: '1.0.0',
      });

      await composer.writeVersion(createContext(project.path, { dryRun: true }), '2.0.0');

      const content = JSON.parse(readFileSync(join(project.path, 'composer.json'), 'utf-8'));
      expect(content.version).toBe('1.0.0'); // Not changed
    });
  });

  describe('getVersionFiles', () => {
    test('returns composer.json', async () => {
      const project = createTestProject(TEST_DIR, 'version-files').withComposerJson();

      const files = await composer.getVersionFiles(createContext(project.path));
      expect(files).toContain('composer.json');
    });

    test('includes composer.lock if exists', async () => {
      const project = createTestProject(TEST_DIR, 'with-lock')
        .withComposerJson()
        .withJson('composer.lock', {});

      const files = await composer.getVersionFiles(createContext(project.path));
      expect(files).toContain('composer.json');
      expect(files).toContain('composer.lock');
    });
  });
});
