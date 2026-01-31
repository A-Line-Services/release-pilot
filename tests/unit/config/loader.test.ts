/**
 * Tests for configuration file loading
 *
 * Tests YAML parsing, validation, and default value application.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyDefaults, loadConfig } from '../../../src/config/loader.js';

const TEST_DIR = join(import.meta.dir, '../../fixtures/configs');

describe('config loader', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    test('loads minimal config file', () => {
      const configPath = join(TEST_DIR, 'minimal.yml');
      writeFileSync(configPath, '# Empty config\n');

      const config = loadConfig(configPath);
      expect(config).toBeDefined();
    });

    test('loads config with packages', () => {
      const configPath = join(TEST_DIR, 'packages.yml');
      writeFileSync(
        configPath,
        `
packages:
  - name: my-app
    ecosystem: npm
  - name: my-crate
    path: ./crates/core
    ecosystem: cargo
`
      );

      const config = loadConfig(configPath);
      expect(config.packages).toHaveLength(2);
      expect(config.packages?.[0]?.name).toBe('my-app');
      expect(config.packages?.[0]?.ecosystem).toBe('npm');
      expect(config.packages?.[1]?.ecosystem).toBe('cargo');
    });

    test('loads config with docker package', () => {
      const configPath = join(TEST_DIR, 'docker.yml');
      writeFileSync(
        configPath,
        `
packages:
  - name: api-image
    ecosystem: docker
    docker:
      registry: ghcr.io
      image: myorg/api
      platforms:
        - linux/amd64
        - linux/arm64
      tags:
        - latest
        - "{version}"
`
      );

      const config = loadConfig(configPath);
      expect(config.packages?.[0]?.docker?.registry).toBe('ghcr.io');
      expect(config.packages?.[0]?.docker?.platforms).toHaveLength(2);
    });

    test('loads config with all sections', () => {
      const configPath = join(TEST_DIR, 'full.yml');
      writeFileSync(
        configPath,
        `
packages:
  - name: core
    ecosystem: npm

releaseOrder:
  - core

labels:
  major: breaking
  minor: feature
  patch: fix

version:
  defaultBump: patch
  devRelease: true
  devSuffix: nightly

git:
  tagPrefix: v
  commitMessage: "release: {version}"

publish:
  enabled: true
  delayBetweenPackages: 45

githubRelease:
  enabled: true
  generateNotes: true

changelog:
  enabled: false
`
      );

      const config = loadConfig(configPath);
      expect(config.labels?.major).toBe('breaking');
      expect(config.version?.devSuffix).toBe('nightly');
      expect(config.publish?.delayBetweenPackages).toBe(45);
    });

    test('throws on invalid YAML syntax', () => {
      const configPath = join(TEST_DIR, 'invalid-yaml.yml');
      writeFileSync(
        configPath,
        `
packages:
  - name: test
    ecosystem: [invalid yaml here
`
      );

      expect(() => loadConfig(configPath)).toThrow();
    });

    test('throws on invalid config structure', () => {
      const configPath = join(TEST_DIR, 'invalid-config.yml');
      writeFileSync(
        configPath,
        `
packages:
  - name: test
    ecosystem: not-a-valid-ecosystem
`
      );

      expect(() => loadConfig(configPath)).toThrow();
    });

    test('throws on non-existent file', () => {
      expect(() => loadConfig('/non/existent/path.yml')).toThrow();
    });
  });

  describe('applyDefaults', () => {
    test('applies default labels', () => {
      const config = applyDefaults({});

      expect(config.labels.major).toBe('release:major');
      expect(config.labels.minor).toBe('release:minor');
      expect(config.labels.patch).toBe('release:patch');
      expect(config.labels.skip).toBe('release:skip');
    });

    test('applies default version settings', () => {
      const config = applyDefaults({});

      expect(config.version.defaultBump).toBe('patch');
      expect(config.version.devRelease).toBe(false);
      expect(config.version.devSuffix).toBe('dev');
    });

    test('applies default git settings', () => {
      const config = applyDefaults({});

      expect(config.git.pushVersionCommit).toBe(true);
      expect(config.git.pushTag).toBe(true);
      expect(config.git.tagPrefix).toBe('v');
      expect(config.git.commitMessage).toBe('chore(release): {version}');
    });

    test('applies default publish settings', () => {
      const config = applyDefaults({});

      expect(config.publish.enabled).toBe(true);
      expect(config.publish.delayBetweenPackages).toBe(30);
    });

    test('applies default GitHub release settings', () => {
      const config = applyDefaults({});

      expect(config.githubRelease.enabled).toBe(true);
      expect(config.githubRelease.draft).toBe(false);
      expect(config.githubRelease.generateNotes).toBe(true);
    });

    test('applies default changelog settings', () => {
      const config = applyDefaults({});

      expect(config.changelog.enabled).toBe(false);
      expect(config.changelog.file).toBe('CHANGELOG.md');
    });

    test('preserves user-provided values', () => {
      const config = applyDefaults({
        labels: {
          major: 'breaking-change',
        },
        version: {
          defaultBump: 'minor',
          devRelease: true,
        },
        git: {
          tagPrefix: '',
        },
      });

      // User values preserved
      expect(config.labels.major).toBe('breaking-change');
      expect(config.version.defaultBump).toBe('minor');
      expect(config.version.devRelease).toBe(true);
      expect(config.git.tagPrefix).toBe('');

      // Defaults applied for missing
      expect(config.labels.minor).toBe('release:minor');
      expect(config.version.devSuffix).toBe('dev');
    });

    test('applies default package path', () => {
      const config = applyDefaults({
        packages: [
          { name: 'no-path', ecosystem: 'npm' },
          { name: 'with-path', path: './custom', ecosystem: 'cargo' },
        ],
      });

      expect(config.packages[0]?.path).toBe('.');
      expect(config.packages[1]?.path).toBe('./custom');
    });

    test('applies default updateVersionFile (true)', () => {
      const config = applyDefaults({
        packages: [
          { name: 'default', ecosystem: 'npm' },
          { name: 'explicit-true', ecosystem: 'cargo', updateVersionFile: true },
          { name: 'explicit-false', ecosystem: 'custom', updateVersionFile: false },
        ],
      });

      expect(config.packages[0]?.updateVersionFile).toBe(true);
      expect(config.packages[1]?.updateVersionFile).toBe(true);
      expect(config.packages[2]?.updateVersionFile).toBe(false);
    });

    test('applies default docker settings', () => {
      const config = applyDefaults({
        packages: [
          {
            name: 'docker-app',
            ecosystem: 'docker',
            docker: { image: 'myorg/app' },
          },
        ],
      });

      const dockerConfig = config.packages[0]?.docker;
      expect(dockerConfig?.registry).toBe('docker.io');
      expect(dockerConfig?.dockerfile).toBe('Dockerfile');
      expect(dockerConfig?.push).toBe(true);
      expect(dockerConfig?.tags).toEqual(['latest', '{version}']);
      expect(dockerConfig?.devTags).toEqual(['dev', '{version}']);
    });

    test('applies default versionFiles settings', () => {
      const config = applyDefaults({});

      expect(config.versionFiles.enabled).toBe(false);
      expect(config.versionFiles.files).toEqual([]);
      expect(config.versionFiles.updateOn.stable).toBe(true);
      expect(config.versionFiles.updateOn.dev).toBe(false);
      expect(config.versionFiles.updateOn.alpha).toBe(false);
      expect(config.versionFiles.updateOn.beta).toBe(false);
      expect(config.versionFiles.updateOn.rc).toBe(false);
    });

    test('applies default versionFiles.updateOn when enabled without updateOn', () => {
      const config = applyDefaults({
        versionFiles: {
          enabled: true,
          files: [{ file: 'README.md', pattern: 'v[0-9]+', replace: 'v{major}' }],
        },
      });

      expect(config.versionFiles.enabled).toBe(true);
      expect(config.versionFiles.files).toHaveLength(1);
      // updateOn should use defaults
      expect(config.versionFiles.updateOn.stable).toBe(true);
      expect(config.versionFiles.updateOn.dev).toBe(false);
      expect(config.versionFiles.updateOn.alpha).toBe(false);
      expect(config.versionFiles.updateOn.beta).toBe(false);
      expect(config.versionFiles.updateOn.rc).toBe(false);
    });

    test('preserves user-provided versionFiles.updateOn values', () => {
      const config = applyDefaults({
        versionFiles: {
          enabled: true,
          updateOn: {
            stable: true,
            rc: true,
            // dev, alpha, beta not specified - should default to false
          },
          files: [{ file: 'README.md', pattern: 'v[0-9]+', replace: 'v{major}' }],
        },
      });

      expect(config.versionFiles.updateOn.stable).toBe(true);
      expect(config.versionFiles.updateOn.rc).toBe(true);
      expect(config.versionFiles.updateOn.dev).toBe(false);
      expect(config.versionFiles.updateOn.alpha).toBe(false);
      expect(config.versionFiles.updateOn.beta).toBe(false);
    });

    test('allows disabling stable in versionFiles.updateOn', () => {
      const config = applyDefaults({
        versionFiles: {
          enabled: true,
          updateOn: {
            stable: false,
            dev: true,
          },
          files: [{ file: 'README.md', pattern: 'v[0-9]+', replace: 'v{major}' }],
        },
      });

      expect(config.versionFiles.updateOn.stable).toBe(false);
      expect(config.versionFiles.updateOn.dev).toBe(true);
    });
  });
});
