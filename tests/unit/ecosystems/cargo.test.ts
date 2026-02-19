/**
 * Tests for cargo (Rust) ecosystem implementation
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CargoEcosystem } from '../../../src/ecosystems/cargo.js';
import { createContext, createTestProject, useTestDir } from '../../helpers/index.js';

describe('CargoEcosystem', () => {
  const cargo = new CargoEcosystem();
  const TEST_DIR = useTestDir('cargo-test');

  describe('properties', () => {
    test('has correct name', () => {
      expect(cargo.name).toBe('cargo');
    });
  });

  describe('detect', () => {
    test('detects Cargo.toml', async () => {
      const project = createTestProject(TEST_DIR, 'detect-test').withCargoToml();
      expect(await cargo.detect(project.path)).toBe(true);
    });

    test('returns false when no Cargo.toml', async () => {
      const project = createTestProject(TEST_DIR, 'empty');
      expect(await cargo.detect(project.path)).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('reads version from Cargo.toml', async () => {
      const project = createTestProject(TEST_DIR, 'read-version').withCargoToml({
        version: '1.2.3',
      });

      const version = await cargo.readVersion(createContext(project.path));
      expect(version).toBe('1.2.3');
    });

    test('reads workspace version', async () => {
      const project = createTestProject(TEST_DIR, 'workspace-version').withCargoToml(
        `[workspace.package]
version = "2.0.0"

[package]
name = "test"
version.workspace = true
`
      );

      const version = await cargo.readVersion(createContext(project.path));
      expect(version).toBe('2.0.0');
    });

    test('throws when version is missing', async () => {
      const project = createTestProject(TEST_DIR, 'no-version').withFile(
        'Cargo.toml',
        `[package]\nname = "test"\n`
      );

      await expect(cargo.readVersion(createContext(project.path))).rejects.toThrow();
    });
  });

  describe('writeVersion', () => {
    test('writes version to Cargo.toml', async () => {
      const project = createTestProject(TEST_DIR, 'write-version').withCargoToml({
        version: '1.0.0',
      });

      await cargo.writeVersion(createContext(project.path), '2.0.0');

      const content = readFileSync(join(project.path, 'Cargo.toml'), 'utf-8');
      expect(content).toContain('version = "2.0.0"');
    });

    test('writes workspace version', async () => {
      const project = createTestProject(TEST_DIR, 'write-workspace').withCargoToml(
        `[workspace.package]
version = "1.0.0"

[package]
name = "test"
version.workspace = true
`
      );

      await cargo.writeVersion(createContext(project.path), '2.0.0');

      const content = readFileSync(join(project.path, 'Cargo.toml'), 'utf-8');
      expect(content).toContain('[workspace.package]');
      expect(content).toMatch(/\[workspace\.package\][^[]*version = "2\.0\.0"/s);
    });

    test('preserves other fields', async () => {
      const project = createTestProject(TEST_DIR, 'preserve-fields').withCargoToml(
        `[package]
name = "test"
version = "1.0.0"
edition = "2021"
authors = ["Test"]

[dependencies]
serde = "1.0"
`
      );

      await cargo.writeVersion(createContext(project.path), '1.1.0');

      const content = readFileSync(join(project.path, 'Cargo.toml'), 'utf-8');
      expect(content).toContain('name = "test"');
      expect(content).toContain('edition = "2021"');
      expect(content).toContain('serde = "1.0"');
    });

    test('skips write in dry run mode', async () => {
      const project = createTestProject(TEST_DIR, 'dry-run').withCargoToml({
        version: '1.0.0',
      });

      await cargo.writeVersion(createContext(project.path, { dryRun: true }), '2.0.0');

      const content = readFileSync(join(project.path, 'Cargo.toml'), 'utf-8');
      expect(content).toContain('version = "1.0.0"');
    });

    test('does not modify rust-version field', async () => {
      const project = createTestProject(TEST_DIR, 'rust-version').withCargoToml(
        `[package]
name = "test"
rust-version = "1.70"
version = "1.0.0"
edition = "2021"
`
      );

      await cargo.writeVersion(createContext(project.path), '2.0.0');

      const content = readFileSync(join(project.path, 'Cargo.toml'), 'utf-8');
      expect(content).toContain('version = "2.0.0"');
      expect(content).toContain('rust-version = "1.70"'); // Should remain unchanged
    });
  });

  describe('workspace member with version.workspace = true', () => {
    test('readVersion resolves version from workspace root Cargo.toml', async () => {
      // Simulate a Cargo workspace: root has [workspace.package] version,
      // member crate uses version.workspace = true
      const project = createTestProject(TEST_DIR, 'ws-read')
        .withCargoToml(
          `[workspace]\nmembers = ["member-crate"]\n\n[workspace.package]\nversion = "3.0.0"\nedition = "2021"\n`
        )
        .withFile(
          'member-crate/Cargo.toml',
          `[package]\nname = "member-crate"\nversion.workspace = true\nedition.workspace = true\n`
        );

      const version = await cargo.readVersion(createContext(join(project.path, 'member-crate')));
      expect(version).toBe('3.0.0');
    });

    test('writeVersion updates workspace root Cargo.toml when member uses version.workspace = true', async () => {
      const project = createTestProject(TEST_DIR, 'ws-write')
        .withCargoToml(
          `[workspace]\nmembers = ["member-crate"]\n\n[workspace.package]\nversion = "1.0.0"\nedition = "2021"\n`
        )
        .withFile(
          'member-crate/Cargo.toml',
          `[package]\nname = "member-crate"\nversion.workspace = true\nedition.workspace = true\n`
        );

      await cargo.writeVersion(createContext(join(project.path, 'member-crate')), '2.0.0');

      // The root Cargo.toml should be updated
      const rootContent = readFileSync(join(project.path, 'Cargo.toml'), 'utf-8');
      expect(rootContent).toContain('version = "2.0.0"');

      // The member Cargo.toml should remain unchanged
      const memberContent = readFileSync(join(project.path, 'member-crate', 'Cargo.toml'), 'utf-8');
      expect(memberContent).toContain('version.workspace = true');
      expect(memberContent).not.toContain('version = "2.0.0"');
    });

    test('getVersionFiles returns workspace root Cargo.toml path for workspace member', async () => {
      const project = createTestProject(TEST_DIR, 'ws-files')
        .withCargoToml(
          `[workspace]\nmembers = ["member-crate"]\n\n[workspace.package]\nversion = "1.0.0"\n`
        )
        .withFile(
          'member-crate/Cargo.toml',
          `[package]\nname = "member-crate"\nversion.workspace = true\n`
        );

      const files = await cargo.getVersionFiles(createContext(join(project.path, 'member-crate')));
      // Should include the workspace root Cargo.toml (relative path from member to root)
      const hasRootToml = files.some((f) => f.includes('..'));
      expect(hasRootToml).toBe(true);
    });
  });

  describe('getVersionFiles', () => {
    test('returns Cargo.toml', async () => {
      const project = createTestProject(TEST_DIR, 'version-files').withCargoToml();

      const files = await cargo.getVersionFiles(createContext(project.path));
      expect(files).toContain('Cargo.toml');
    });

    test('includes Cargo.lock if exists', async () => {
      const project = createTestProject(TEST_DIR, 'with-lock')
        .withCargoToml()
        .withFile('Cargo.lock', '');

      const files = await cargo.getVersionFiles(createContext(project.path));
      expect(files).toContain('Cargo.toml');
      expect(files).toContain('Cargo.lock');
    });
  });
});
