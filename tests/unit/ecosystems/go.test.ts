/**
 * Tests for Go ecosystem implementation
 */

import { describe, expect, test } from 'bun:test';
import { GoEcosystem } from '../../../src/ecosystems/go.js';
import { createContext, createTestProject, useTestDir } from '../../helpers/index.js';

describe('GoEcosystem', () => {
  const go = new GoEcosystem();
  const TEST_DIR = useTestDir('go-test');

  describe('properties', () => {
    test('has correct name', () => {
      expect(go.name).toBe('go');
    });
  });

  describe('detect', () => {
    test('detects go.mod', async () => {
      const project = createTestProject(TEST_DIR, 'detect-test').withGoMod();
      expect(await go.detect(project.path)).toBe(true);
    });

    test('returns false when no go.mod', async () => {
      const project = createTestProject(TEST_DIR, 'empty');
      expect(await go.detect(project.path)).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('returns 0.0.0 (Go uses git tags)', async () => {
      const project = createTestProject(TEST_DIR, 'read-version').withGoMod();

      const version = await go.readVersion(createContext(project.path));
      // Go uses git tags for versioning, so this always returns 0.0.0
      expect(version).toBe('0.0.0');
    });
  });

  describe('writeVersion', () => {
    test('is a no-op (Go uses git tags)', async () => {
      const project = createTestProject(TEST_DIR, 'write-version').withGoMod();

      // This should not throw
      await go.writeVersion(createContext(project.path), '2.0.0');
      // go.mod should remain unchanged (Go versioning is via git tags)
    });
  });

  describe('getVersionFiles', () => {
    test('returns go.mod', async () => {
      const project = createTestProject(TEST_DIR, 'version-files').withGoMod();

      const files = await go.getVersionFiles(createContext(project.path));
      expect(files).toContain('go.mod');
    });
  });
});
