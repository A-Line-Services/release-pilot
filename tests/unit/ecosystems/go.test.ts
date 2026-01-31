/**
 * Tests for Go ecosystem implementation
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EcosystemContext } from '../../../src/ecosystems/base.js';
import { GoEcosystem } from '../../../src/ecosystems/go.js';

const TEST_DIR = join(import.meta.dir, '../../fixtures/go-test');

function createContext(path: string, options: Partial<EcosystemContext> = {}): EcosystemContext {
  return {
    path,
    dryRun: false,
    log: () => {},
    ...options,
  };
}

describe('GoEcosystem', () => {
  const go = new GoEcosystem();

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('properties', () => {
    test('has correct name', () => {
      expect(go.name).toBe('go');
    });
  });

  describe('detect', () => {
    test('detects go.mod', async () => {
      const projectDir = join(TEST_DIR, 'detect-test');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'go.mod'), 'module example.com/test\n\ngo 1.21');

      expect(await go.detect(projectDir)).toBe(true);
    });

    test('returns false when no go.mod', async () => {
      const emptyDir = join(TEST_DIR, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      expect(await go.detect(emptyDir)).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('returns 0.0.0 (Go uses git tags)', async () => {
      const projectDir = join(TEST_DIR, 'read-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'go.mod'), 'module example.com/test\n\ngo 1.21');

      const version = await go.readVersion(createContext(projectDir));

      // Go uses git tags for versioning, so this always returns 0.0.0
      expect(version).toBe('0.0.0');
    });
  });

  describe('writeVersion', () => {
    test('is a no-op (Go uses git tags)', async () => {
      const projectDir = join(TEST_DIR, 'write-version');
      mkdirSync(projectDir, { recursive: true });
      const goModContent = 'module example.com/test\n\ngo 1.21';
      writeFileSync(join(projectDir, 'go.mod'), goModContent);

      // This should not throw
      await go.writeVersion(createContext(projectDir), '2.0.0');

      // go.mod should remain unchanged (Go versioning is via git tags)
    });
  });

  describe('getVersionFiles', () => {
    test('returns go.mod', async () => {
      const projectDir = join(TEST_DIR, 'version-files');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'go.mod'), 'module example.com/test');

      const files = await go.getVersionFiles(createContext(projectDir));

      expect(files).toContain('go.mod');
    });
  });
});
