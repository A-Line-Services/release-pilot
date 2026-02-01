/**
 * Tests for npm ecosystem implementation
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NpmEcosystem } from '../../../src/ecosystems/npm.js';
import { createContext, createTestProject, useTestDir } from '../../helpers/index.js';

describe('NpmEcosystem', () => {
  const npm = new NpmEcosystem();
  const TEST_DIR = useTestDir('npm-test');

  describe('properties', () => {
    test('has correct name', () => {
      expect(npm.name).toBe('npm');
    });
  });

  describe('detect', () => {
    test('detects package.json', async () => {
      const project = createTestProject(TEST_DIR, 'detect-test').withPackageJson();
      expect(await npm.detect(project.path)).toBe(true);
    });

    test('returns false when no package.json', async () => {
      const project = createTestProject(TEST_DIR, 'empty');
      expect(await npm.detect(project.path)).toBe(false);
    });

    test('returns false for non-existent directory', async () => {
      expect(await npm.detect('/non/existent/path')).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('reads version from package.json', async () => {
      const project = createTestProject(TEST_DIR, 'read-version').withPackageJson({
        version: '1.2.3',
      });

      const version = await npm.readVersion(createContext(project.path));
      expect(version).toBe('1.2.3');
    });

    test('throws when version is missing', async () => {
      const project = createTestProject(TEST_DIR, 'no-version').withJson('package.json', {
        name: 'test',
      });

      await expect(npm.readVersion(createContext(project.path))).rejects.toThrow();
    });

    test('throws when package.json is missing', async () => {
      const project = createTestProject(TEST_DIR, 'no-pkg');
      await expect(npm.readVersion(createContext(project.path))).rejects.toThrow();
    });

    test('uses custom versionFile', async () => {
      const project = createTestProject(TEST_DIR, 'custom-file').withJson('custom.json', {
        name: 'test',
        version: '2.0.0',
      });

      const version = await npm.readVersion(
        createContext(project.path, { versionFile: 'custom.json' })
      );
      expect(version).toBe('2.0.0');
    });
  });

  describe('writeVersion', () => {
    test('writes version to package.json', async () => {
      const project = createTestProject(TEST_DIR, 'write-version').withPackageJson({
        version: '1.0.0',
      });

      await npm.writeVersion(createContext(project.path), '2.0.0');

      const content = JSON.parse(readFileSync(join(project.path, 'package.json'), 'utf-8'));
      expect(content.version).toBe('2.0.0');
    });

    test('preserves other package.json fields', async () => {
      const project = createTestProject(TEST_DIR, 'preserve-fields').withPackageJson({
        version: '1.0.0',
        description: 'A test package',
        dependencies: { lodash: '^4.0.0' },
      });

      await npm.writeVersion(createContext(project.path), '1.1.0');

      const content = JSON.parse(readFileSync(join(project.path, 'package.json'), 'utf-8'));
      expect(content.version).toBe('1.1.0');
      expect(content.name).toBe('test-package');
      expect(content.description).toBe('A test package');
      expect(content.dependencies.lodash).toBe('^4.0.0');
    });

    test('preserves formatting (2-space indent)', async () => {
      const project = createTestProject(TEST_DIR, 'preserve-format').withPackageJson({
        version: '1.0.0',
      });

      await npm.writeVersion(createContext(project.path), '1.1.0');

      const content = readFileSync(join(project.path, 'package.json'), 'utf-8');
      expect(content).toContain('  "name"'); // 2-space indent preserved
    });

    test('skips write in dry run mode', async () => {
      const project = createTestProject(TEST_DIR, 'dry-run').withPackageJson({
        version: '1.0.0',
      });

      await npm.writeVersion(createContext(project.path, { dryRun: true }), '2.0.0');

      const content = JSON.parse(readFileSync(join(project.path, 'package.json'), 'utf-8'));
      expect(content.version).toBe('1.0.0'); // Not changed
    });
  });

  describe('getVersionFiles', () => {
    test('returns package.json', async () => {
      const project = createTestProject(TEST_DIR, 'version-files').withPackageJson();

      const files = await npm.getVersionFiles(createContext(project.path));
      expect(files).toContain('package.json');
    });

    test('includes package-lock.json if exists', async () => {
      const project = createTestProject(TEST_DIR, 'with-lock')
        .withPackageJson()
        .withJson('package-lock.json', {});

      const files = await npm.getVersionFiles(createContext(project.path));
      expect(files).toContain('package.json');
      expect(files).toContain('package-lock.json');
    });

    test('includes npm-shrinkwrap.json if exists', async () => {
      const project = createTestProject(TEST_DIR, 'with-shrinkwrap')
        .withPackageJson()
        .withJson('npm-shrinkwrap.json', {});

      const files = await npm.getVersionFiles(createContext(project.path));
      expect(files).toContain('npm-shrinkwrap.json');
    });
  });
});
