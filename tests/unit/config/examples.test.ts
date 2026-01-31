/**
 * Tests for example configuration files
 *
 * Validates that all example configurations in the examples/ directory
 * are valid and parse correctly against the schema. This ensures that
 * schema changes don't silently break the examples.
 */

import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { applyDefaults, loadConfig } from '../../../src/config/loader.js';

const EXAMPLES_DIR = join(import.meta.dir, '../../../examples');
const PROJECT_ROOT = join(import.meta.dir, '../../..');

/**
 * Discovers all example directories that contain release-pilot.yml configs
 */
function discoverExampleConfigs(): { name: string; configPath: string }[] {
  const examples: { name: string; configPath: string }[] = [];

  const entries = readdirSync(EXAMPLES_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const configPath = join(EXAMPLES_DIR, entry.name, '.github', 'release-pilot.yml');
    if (existsSync(configPath)) {
      examples.push({ name: entry.name, configPath });
    }
  }

  return examples;
}

describe('example configurations', () => {
  const exampleConfigs = discoverExampleConfigs();

  test('discovers example configurations', () => {
    // Ensure we're testing something
    expect(exampleConfigs.length).toBeGreaterThan(0);
  });

  describe('each example config is valid', () => {
    for (const { name, configPath } of exampleConfigs) {
      test(`examples/${name}/.github/release-pilot.yml loads without error`, () => {
        expect(() => loadConfig(configPath)).not.toThrow();
      });

      test(`examples/${name}/.github/release-pilot.yml can have defaults applied`, () => {
        const config = loadConfig(configPath);
        expect(() => applyDefaults(config)).not.toThrow();

        const resolved = applyDefaults(config);
        // All resolved configs should have these sections
        expect(resolved.labels).toBeDefined();
        expect(resolved.version).toBeDefined();
        expect(resolved.git).toBeDefined();
        expect(resolved.publish).toBeDefined();
      });
    }
  });

  describe('example configs have valid package ecosystems', () => {
    const validEcosystems = ['npm', 'cargo', 'python', 'go', 'composer', 'docker', 'custom'];

    for (const { name, configPath } of exampleConfigs) {
      test(`examples/${name} uses valid ecosystems`, () => {
        const config = loadConfig(configPath);
        const resolved = applyDefaults(config);

        for (const pkg of resolved.packages) {
          expect(validEcosystems).toContain(pkg.ecosystem);
        }
      });
    }
  });

  describe('example configs have consistent package references', () => {
    for (const { name, configPath } of exampleConfigs) {
      test(`examples/${name} releaseOrder references valid packages`, () => {
        const config = loadConfig(configPath);
        const resolved = applyDefaults(config);

        if (resolved.releaseOrder && resolved.releaseOrder.length > 0) {
          const packageNames = resolved.packages.map((p) => p.name);
          for (const orderedPkg of resolved.releaseOrder) {
            expect(packageNames).toContain(orderedPkg);
          }
        }
      });
    }
  });
});

describe('project configuration', () => {
  const projectConfigPath = join(PROJECT_ROOT, '.github', 'release-pilot.yml');

  test('project has its own release-pilot.yml', () => {
    expect(existsSync(projectConfigPath)).toBe(true);
  });

  test('project config loads without error', () => {
    expect(() => loadConfig(projectConfigPath)).not.toThrow();
  });

  test('project config can have defaults applied', () => {
    const config = loadConfig(projectConfigPath);
    expect(() => applyDefaults(config)).not.toThrow();
  });

  test('project config has versionFiles enabled', () => {
    const config = loadConfig(projectConfigPath);
    const resolved = applyDefaults(config);
    expect(resolved.versionFiles.enabled).toBe(true);
  });

  test('project config versionFiles includes README.md', () => {
    const config = loadConfig(projectConfigPath);
    const resolved = applyDefaults(config);
    const readmeFile = resolved.versionFiles.files.find((f) => f.file === 'README.md');
    expect(readmeFile).toBeDefined();
    expect(readmeFile?.pattern).toContain('release-pilot');
  });

  test('project config versionFiles includes all example workflow files', () => {
    const config = loadConfig(projectConfigPath);
    const resolved = applyDefaults(config);

    // Get all example directories that have workflow files
    const exampleDirs = readdirSync(EXAMPLES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    for (const exampleDir of exampleDirs) {
      const workflowPath = `examples/${exampleDir}/.github/workflows/release.yml`;
      const fullPath = join(PROJECT_ROOT, workflowPath);

      if (existsSync(fullPath)) {
        const versionFile = resolved.versionFiles.files.find((f) => f.file === workflowPath);
        expect(versionFile).toBeDefined();
      }
    }
  });
});
