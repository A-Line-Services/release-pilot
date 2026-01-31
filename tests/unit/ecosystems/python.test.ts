/**
 * Tests for Python ecosystem implementation
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EcosystemContext } from '../../../src/ecosystems/base.js';
import { PythonEcosystem } from '../../../src/ecosystems/python.js';

const TEST_DIR = join(import.meta.dir, '../../fixtures/python-test');

function createContext(path: string, options: Partial<EcosystemContext> = {}): EcosystemContext {
  return {
    path,
    dryRun: false,
    log: () => {},
    ...options,
  };
}

describe('PythonEcosystem', () => {
  const python = new PythonEcosystem();

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('properties', () => {
    test('has correct name', () => {
      expect(python.name).toBe('python');
    });
  });

  describe('detect', () => {
    test('detects pyproject.toml', async () => {
      const projectDir = join(TEST_DIR, 'detect-test');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'pyproject.toml'), '[project]\nname = "test"');

      expect(await python.detect(projectDir)).toBe(true);
    });

    test('returns false when no pyproject.toml', async () => {
      const emptyDir = join(TEST_DIR, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      expect(await python.detect(emptyDir)).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('reads version from [project] section', async () => {
      const projectDir = join(TEST_DIR, 'read-project');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'pyproject.toml'),
        `[project]
name = "test"
version = "1.2.3"
`
      );

      const version = await python.readVersion(createContext(projectDir));

      expect(version).toBe('1.2.3');
    });

    test('reads version from [tool.poetry] section', async () => {
      const projectDir = join(TEST_DIR, 'read-poetry');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'pyproject.toml'),
        `[tool.poetry]
name = "test"
version = "2.0.0"
`
      );

      const version = await python.readVersion(createContext(projectDir));

      expect(version).toBe('2.0.0');
    });

    test('prefers [project] over [tool.poetry]', async () => {
      const projectDir = join(TEST_DIR, 'read-both');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'pyproject.toml'),
        `[project]
name = "test"
version = "1.0.0"

[tool.poetry]
name = "test"
version = "2.0.0"
`
      );

      const version = await python.readVersion(createContext(projectDir));

      expect(version).toBe('1.0.0');
    });

    test('throws when version is missing', async () => {
      const projectDir = join(TEST_DIR, 'no-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'pyproject.toml'),
        `[project]
name = "test"
`
      );

      await expect(python.readVersion(createContext(projectDir))).rejects.toThrow();
    });
  });

  describe('writeVersion', () => {
    test('writes version to [project] section', async () => {
      const projectDir = join(TEST_DIR, 'write-project');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'pyproject.toml'),
        `[project]
name = "test"
version = "1.0.0"
`
      );

      await python.writeVersion(createContext(projectDir), '2.0.0');

      const content = readFileSync(join(projectDir, 'pyproject.toml'), 'utf-8');
      expect(content).toContain('version = "2.0.0"');
    });

    test('writes version to [tool.poetry] section', async () => {
      const projectDir = join(TEST_DIR, 'write-poetry');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'pyproject.toml'),
        `[tool.poetry]
name = "test"
version = "1.0.0"
`
      );

      await python.writeVersion(createContext(projectDir), '2.0.0');

      const content = readFileSync(join(projectDir, 'pyproject.toml'), 'utf-8');
      expect(content).toContain('version = "2.0.0"');
    });

    test('preserves other fields', async () => {
      const projectDir = join(TEST_DIR, 'preserve-fields');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'pyproject.toml'),
        `[project]
name = "test"
version = "1.0.0"
description = "A test package"

[project.dependencies]
requests = ">=2.0"
`
      );

      await python.writeVersion(createContext(projectDir), '1.1.0');

      const content = readFileSync(join(projectDir, 'pyproject.toml'), 'utf-8');
      expect(content).toContain('name = "test"');
      expect(content).toContain('description = "A test package"');
      expect(content).toContain('requests = ">=2.0"');
    });

    test('skips write in dry run mode', async () => {
      const projectDir = join(TEST_DIR, 'dry-run');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'pyproject.toml'),
        `[project]
name = "test"
version = "1.0.0"
`
      );

      await python.writeVersion(createContext(projectDir, { dryRun: true }), '2.0.0');

      const content = readFileSync(join(projectDir, 'pyproject.toml'), 'utf-8');
      expect(content).toContain('version = "1.0.0"');
    });
  });

  describe('getVersionFiles', () => {
    test('returns pyproject.toml', async () => {
      const projectDir = join(TEST_DIR, 'version-files');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'pyproject.toml'), '[project]');

      const files = await python.getVersionFiles(createContext(projectDir));

      expect(files).toContain('pyproject.toml');
    });

    test('includes uv.lock if exists', async () => {
      const projectDir = join(TEST_DIR, 'with-uv-lock');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'pyproject.toml'), '[project]');
      writeFileSync(join(projectDir, 'uv.lock'), '');

      const files = await python.getVersionFiles(createContext(projectDir));

      expect(files).toContain('pyproject.toml');
      expect(files).toContain('uv.lock');
    });

    test('includes poetry.lock if exists', async () => {
      const projectDir = join(TEST_DIR, 'with-poetry-lock');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'pyproject.toml'), '[project]');
      writeFileSync(join(projectDir, 'poetry.lock'), '');

      const files = await python.getVersionFiles(createContext(projectDir));

      expect(files).toContain('poetry.lock');
    });
  });
});
