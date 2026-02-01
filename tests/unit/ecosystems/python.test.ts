/**
 * Tests for Python ecosystem implementation
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PythonEcosystem } from '../../../src/ecosystems/python.js';
import { createContext, createTestProject, useTestDir } from '../../helpers/index.js';

describe('PythonEcosystem', () => {
  const python = new PythonEcosystem();
  const TEST_DIR = useTestDir('python-test');

  describe('properties', () => {
    test('has correct name', () => {
      expect(python.name).toBe('python');
    });
  });

  describe('detect', () => {
    test('detects pyproject.toml', async () => {
      const project = createTestProject(TEST_DIR, 'detect-test').withPyprojectToml();
      expect(await python.detect(project.path)).toBe(true);
    });

    test('returns false when no pyproject.toml', async () => {
      const project = createTestProject(TEST_DIR, 'empty');
      expect(await python.detect(project.path)).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('reads version from [project] section', async () => {
      const project = createTestProject(TEST_DIR, 'read-project').withPyprojectToml({
        version: '1.2.3',
      });

      const version = await python.readVersion(createContext(project.path));
      expect(version).toBe('1.2.3');
    });

    test('reads version from [tool.poetry] section', async () => {
      const project = createTestProject(TEST_DIR, 'read-poetry').withPyprojectToml(
        `[tool.poetry]
name = "test"
version = "2.0.0"
`
      );

      const version = await python.readVersion(createContext(project.path));
      expect(version).toBe('2.0.0');
    });

    test('prefers [project] over [tool.poetry]', async () => {
      const project = createTestProject(TEST_DIR, 'read-both').withPyprojectToml(
        `[project]
name = "test"
version = "1.0.0"

[tool.poetry]
name = "test"
version = "2.0.0"
`
      );

      const version = await python.readVersion(createContext(project.path));
      expect(version).toBe('1.0.0');
    });

    test('throws when version is missing', async () => {
      const project = createTestProject(TEST_DIR, 'no-version').withFile(
        'pyproject.toml',
        `[project]\nname = "test"\n`
      );

      await expect(python.readVersion(createContext(project.path))).rejects.toThrow();
    });
  });

  describe('writeVersion', () => {
    test('writes version to [project] section', async () => {
      const project = createTestProject(TEST_DIR, 'write-project').withPyprojectToml({
        version: '1.0.0',
      });

      await python.writeVersion(createContext(project.path), '2.0.0');

      const content = readFileSync(join(project.path, 'pyproject.toml'), 'utf-8');
      expect(content).toContain('version = "2.0.0"');
    });

    test('writes version to [tool.poetry] section', async () => {
      const project = createTestProject(TEST_DIR, 'write-poetry').withPyprojectToml(
        `[tool.poetry]
name = "test"
version = "1.0.0"
`
      );

      await python.writeVersion(createContext(project.path), '2.0.0');

      const content = readFileSync(join(project.path, 'pyproject.toml'), 'utf-8');
      expect(content).toContain('version = "2.0.0"');
    });

    test('preserves other fields', async () => {
      const project = createTestProject(TEST_DIR, 'preserve-fields').withPyprojectToml(
        `[project]
name = "test"
version = "1.0.0"
description = "A test package"

[project.dependencies]
requests = ">=2.0"
`
      );

      await python.writeVersion(createContext(project.path), '1.1.0');

      const content = readFileSync(join(project.path, 'pyproject.toml'), 'utf-8');
      expect(content).toContain('name = "test"');
      expect(content).toContain('description = "A test package"');
      expect(content).toContain('requests = ">=2.0"');
    });

    test('skips write in dry run mode', async () => {
      const project = createTestProject(TEST_DIR, 'dry-run').withPyprojectToml({
        version: '1.0.0',
      });

      await python.writeVersion(createContext(project.path, { dryRun: true }), '2.0.0');

      const content = readFileSync(join(project.path, 'pyproject.toml'), 'utf-8');
      expect(content).toContain('version = "1.0.0"');
    });
  });

  describe('getVersionFiles', () => {
    test('returns pyproject.toml', async () => {
      const project = createTestProject(TEST_DIR, 'version-files').withPyprojectToml();

      const files = await python.getVersionFiles(createContext(project.path));
      expect(files).toContain('pyproject.toml');
    });

    test('includes uv.lock if exists', async () => {
      const project = createTestProject(TEST_DIR, 'with-uv-lock')
        .withPyprojectToml()
        .withFile('uv.lock', '');

      const files = await python.getVersionFiles(createContext(project.path));
      expect(files).toContain('pyproject.toml');
      expect(files).toContain('uv.lock');
    });

    test('includes poetry.lock if exists', async () => {
      const project = createTestProject(TEST_DIR, 'with-poetry-lock')
        .withPyprojectToml()
        .withFile('poetry.lock', '');

      const files = await python.getVersionFiles(createContext(project.path));
      expect(files).toContain('poetry.lock');
    });
  });
});
