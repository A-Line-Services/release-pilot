/**
 * Tests for configuration schema validation
 *
 * The config schema defines the structure of .github/release-pilot.yml
 * Uses Arri Schema for runtime validation.
 *
 * TODO: Add JSON Schema generation for editor support once upstream
 * contribution to @arrirpc/schema is merged.
 */

import { describe, expect, test } from 'bun:test';
import { a } from '@arrirpc/schema';
import {
  DockerConfig,
  EcosystemType,
  PackageConfig,
  type PackageConfigType,
  ReleasePilotConfig,
  type ReleasePilotConfigType,
} from '../../../src/config/schema.js';

describe('config schema', () => {
  describe('EcosystemType', () => {
    test('accepts valid ecosystem types', () => {
      expect(a.validate(EcosystemType, 'npm')).toBe(true);
      expect(a.validate(EcosystemType, 'cargo')).toBe(true);
      expect(a.validate(EcosystemType, 'python')).toBe(true);
      expect(a.validate(EcosystemType, 'go')).toBe(true);
      expect(a.validate(EcosystemType, 'composer')).toBe(true);
      expect(a.validate(EcosystemType, 'docker')).toBe(true);
      expect(a.validate(EcosystemType, 'custom')).toBe(true);
    });

    test('rejects invalid ecosystem types', () => {
      expect(a.validate(EcosystemType, 'invalid')).toBe(false);
      expect(a.validate(EcosystemType, 'ruby')).toBe(false);
      expect(a.validate(EcosystemType, '')).toBe(false);
    });
  });

  describe('PackageConfig', () => {
    test('accepts minimal package config', () => {
      const config = {
        name: 'my-package',
        ecosystem: 'npm',
      };
      expect(a.validate(PackageConfig, config)).toBe(true);
    });

    test('accepts full package config', () => {
      const config: PackageConfigType = {
        name: 'my-package',
        path: './packages/core',
        ecosystem: 'npm',
        versionFile: 'package.json',
        publish: true,
      };
      expect(a.validate(PackageConfig, config)).toBe(true);
    });

    test('accepts custom ecosystem with commands', () => {
      const config = {
        name: 'my-package',
        ecosystem: 'custom',
        publishCommand: './scripts/publish.sh',
        publishArgs: ['--verbose', '--dry-run'],
      };
      expect(a.validate(PackageConfig, config)).toBe(true);
    });

    test('rejects package without name', () => {
      const config = {
        ecosystem: 'npm',
      };
      expect(a.validate(PackageConfig, config)).toBe(false);
    });

    test('rejects package without ecosystem', () => {
      const config = {
        name: 'my-package',
      };
      expect(a.validate(PackageConfig, config)).toBe(false);
    });
  });

  describe('DockerConfig', () => {
    test('accepts minimal docker config', () => {
      const config = {
        image: 'myorg/myapp',
      };
      expect(a.validate(DockerConfig, config)).toBe(true);
    });

    test('accepts full docker config', () => {
      const config = {
        registry: 'ghcr.io',
        image: 'myorg/myapp',
        username: 'user',
        password: 'token',
        dockerfile: 'Dockerfile.prod',
        context: './docker',
        buildArgs: {
          NODE_ENV: 'production',
          VERSION: '1.0.0',
        },
        platforms: ['linux/amd64', 'linux/arm64'],
        target: 'production',
        tags: ['latest', '{version}', '{major}.{minor}'],
        devTags: ['dev', '{version}'],
        push: true,
      };
      expect(a.validate(DockerConfig, config)).toBe(true);
    });

    test('rejects docker config without image', () => {
      const config = {
        registry: 'ghcr.io',
      };
      expect(a.validate(DockerConfig, config)).toBe(false);
    });
  });

  describe('ReleasePilotConfig', () => {
    test('accepts empty config (all defaults)', () => {
      const config = {};
      expect(a.validate(ReleasePilotConfig, config)).toBe(true);
    });

    test('accepts config with single package', () => {
      const config: ReleasePilotConfigType = {
        packages: [
          {
            name: 'my-app',
            ecosystem: 'npm',
          },
        ],
      };
      expect(a.validate(ReleasePilotConfig, config)).toBe(true);
    });

    test('accepts config with multiple packages and release order', () => {
      const config: ReleasePilotConfigType = {
        packages: [
          { name: 'core', path: './packages/core', ecosystem: 'npm' },
          { name: 'cli', path: './packages/cli', ecosystem: 'npm' },
          { name: 'docker', ecosystem: 'docker', docker: { image: 'myorg/app' } },
        ],
        releaseOrder: ['core', 'cli', 'docker'],
      };
      expect(a.validate(ReleasePilotConfig, config)).toBe(true);
    });

    test('accepts config with custom labels', () => {
      const config: ReleasePilotConfigType = {
        labels: {
          major: 'breaking-change',
          minor: 'feature',
          patch: 'bugfix',
          skip: 'no-release',
        },
      };
      expect(a.validate(ReleasePilotConfig, config)).toBe(true);
    });

    test('accepts config with version settings', () => {
      const config: ReleasePilotConfigType = {
        version: {
          defaultBump: 'minor',
          devRelease: true,
          devSuffix: 'nightly',
          prereleasePattern: '-rc|-beta|-alpha',
        },
      };
      expect(a.validate(ReleasePilotConfig, config)).toBe(true);
    });

    test('accepts config with git settings', () => {
      const config: ReleasePilotConfigType = {
        git: {
          pushVersionCommit: true,
          pushTag: true,
          tagPrefix: 'v',
          commitMessage: 'chore(release): {version}',
        },
      };
      expect(a.validate(ReleasePilotConfig, config)).toBe(true);
    });

    test('accepts config with publish settings', () => {
      const config: ReleasePilotConfigType = {
        publish: {
          enabled: true,
          delayBetweenPackages: 45,
        },
      };
      expect(a.validate(ReleasePilotConfig, config)).toBe(true);
    });

    test('accepts config with GitHub release settings', () => {
      const config: ReleasePilotConfigType = {
        githubRelease: {
          enabled: true,
          draft: false,
          generateNotes: true,
        },
      };
      expect(a.validate(ReleasePilotConfig, config)).toBe(true);
    });

    test('accepts config with changelog settings', () => {
      const config: ReleasePilotConfigType = {
        changelog: {
          enabled: true,
          file: 'CHANGELOG.md',
        },
      };
      expect(a.validate(ReleasePilotConfig, config)).toBe(true);
    });

    test('accepts full realistic config', () => {
      const config: ReleasePilotConfigType = {
        packages: [
          { name: 'api', path: './packages/api', ecosystem: 'npm' },
          {
            name: 'api-docker',
            ecosystem: 'docker',
            docker: {
              registry: 'ghcr.io',
              image: 'myorg/api',
              platforms: ['linux/amd64', 'linux/arm64'],
              tags: ['latest', '{version}'],
            },
          },
        ],
        releaseOrder: ['api', 'api-docker'],
        labels: {
          major: 'release:major',
          minor: 'release:minor',
          patch: 'release:patch',
        },
        version: {
          defaultBump: 'patch',
          devRelease: true,
        },
        git: {
          tagPrefix: 'v',
        },
        publish: {
          delayBetweenPackages: 30,
        },
        githubRelease: {
          generateNotes: true,
        },
      };
      expect(a.validate(ReleasePilotConfig, config)).toBe(true);
    });

    test('provides useful error messages for invalid config', () => {
      const config = {
        packages: [
          {
            name: 'my-package',
            ecosystem: 'invalid-ecosystem',
          },
        ],
      };

      const errors = a.errors(ReleasePilotConfig, config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.instancePath.includes('ecosystem'))).toBe(true);
    });
  });
});
