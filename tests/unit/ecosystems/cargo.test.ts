/**
 * Tests for cargo (Rust) ecosystem implementation
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { CargoEcosystem } from '../../../src/ecosystems/cargo.js';
import type { EcosystemContext } from '../../../src/ecosystems/base.js';

const TEST_DIR = join(import.meta.dir, '../../fixtures/cargo-test');

function createContext(path: string, options: Partial<EcosystemContext> = {}): EcosystemContext {
  return {
    path,
    dryRun: false,
    log: () => {},
    ...options,
  };
}

describe('CargoEcosystem', () => {
  const cargo = new CargoEcosystem();

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('properties', () => {
    test('has correct name', () => {
      expect(cargo.name).toBe('cargo');
    });
  });

  describe('detect', () => {
    test('detects Cargo.toml', async () => {
      const projectDir = join(TEST_DIR, 'detect-test');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'Cargo.toml'), '[package]\nname = "test"');

      expect(await cargo.detect(projectDir)).toBe(true);
    });

    test('returns false when no Cargo.toml', async () => {
      const emptyDir = join(TEST_DIR, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      expect(await cargo.detect(emptyDir)).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('reads version from Cargo.toml', async () => {
      const projectDir = join(TEST_DIR, 'read-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'Cargo.toml'),
        `[package]
name = "test"
version = "1.2.3"
`
      );

      const version = await cargo.readVersion(createContext(projectDir));

      expect(version).toBe('1.2.3');
    });

    test('reads workspace version', async () => {
      const projectDir = join(TEST_DIR, 'workspace-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'Cargo.toml'),
        `[workspace.package]
version = "2.0.0"

[package]
name = "test"
version.workspace = true
`
      );

      const version = await cargo.readVersion(createContext(projectDir));

      expect(version).toBe('2.0.0');
    });

    test('throws when version is missing', async () => {
      const projectDir = join(TEST_DIR, 'no-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'Cargo.toml'),
        `[package]
name = "test"
`
      );

      await expect(cargo.readVersion(createContext(projectDir))).rejects.toThrow();
    });
  });

  describe('writeVersion', () => {
    test('writes version to Cargo.toml', async () => {
      const projectDir = join(TEST_DIR, 'write-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'Cargo.toml'),
        `[package]
name = "test"
version = "1.0.0"
`
      );

      await cargo.writeVersion(createContext(projectDir), '2.0.0');

      const content = readFileSync(join(projectDir, 'Cargo.toml'), 'utf-8');
      expect(content).toContain('version = "2.0.0"');
    });

    test('writes workspace version', async () => {
      const projectDir = join(TEST_DIR, 'write-workspace');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'Cargo.toml'),
        `[workspace.package]
version = "1.0.0"

[package]
name = "test"
version.workspace = true
`
      );

      await cargo.writeVersion(createContext(projectDir), '2.0.0');

      const content = readFileSync(join(projectDir, 'Cargo.toml'), 'utf-8');
      expect(content).toContain('[workspace.package]');
      expect(content).toMatch(/\[workspace\.package\][^[]*version = "2\.0\.0"/s);
    });

    test('preserves other fields', async () => {
      const projectDir = join(TEST_DIR, 'preserve-fields');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'Cargo.toml'),
        `[package]
name = "test"
version = "1.0.0"
edition = "2021"
authors = ["Test"]

[dependencies]
serde = "1.0"
`
      );

      await cargo.writeVersion(createContext(projectDir), '1.1.0');

      const content = readFileSync(join(projectDir, 'Cargo.toml'), 'utf-8');
      expect(content).toContain('name = "test"');
      expect(content).toContain('edition = "2021"');
      expect(content).toContain('serde = "1.0"');
    });

    test('skips write in dry run mode', async () => {
      const projectDir = join(TEST_DIR, 'dry-run');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'Cargo.toml'),
        `[package]
name = "test"
version = "1.0.0"
`
      );

      await cargo.writeVersion(createContext(projectDir, { dryRun: true }), '2.0.0');

      const content = readFileSync(join(projectDir, 'Cargo.toml'), 'utf-8');
      expect(content).toContain('version = "1.0.0"');
    });
  });

  describe('getVersionFiles', () => {
    test('returns Cargo.toml', async () => {
      const projectDir = join(TEST_DIR, 'version-files');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'Cargo.toml'), '[package]');

      const files = await cargo.getVersionFiles(createContext(projectDir));

      expect(files).toContain('Cargo.toml');
    });

    test('includes Cargo.lock if exists', async () => {
      const projectDir = join(TEST_DIR, 'with-lock');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'Cargo.toml'), '[package]');
      writeFileSync(join(projectDir, 'Cargo.lock'), '');

      const files = await cargo.getVersionFiles(createContext(projectDir));

      expect(files).toContain('Cargo.toml');
      expect(files).toContain('Cargo.lock');
    });
  });
});
