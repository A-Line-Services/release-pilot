/**
 * Tests for cleanup operations
 *
 * Tests release type detection, filtering, and cleanup logic.
 */

import { describe, expect, test } from 'bun:test';
import {
  getReleasesToCleanup,
  getReleaseType,
  getTagsToCleanup,
} from '../../../src/core/cleanup.js';
import type { ReleaseInfo } from '../../../src/github/client.js';

describe('cleanup utilities', () => {
  describe('getReleaseType', () => {
    test('identifies stable releases', () => {
      expect(getReleaseType('1.2.3')).toBe('stable');
      expect(getReleaseType('0.1.0')).toBe('stable');
      expect(getReleaseType('10.20.30')).toBe('stable');
    });

    test('identifies dev releases', () => {
      expect(getReleaseType('1.2.3-dev.abc1234')).toBe('dev');
      expect(getReleaseType('1.0.0-dev.1')).toBe('dev');
      expect(getReleaseType('0.1.0-dev.20240101')).toBe('dev');
    });

    test('identifies alpha releases', () => {
      expect(getReleaseType('1.2.3-alpha.1')).toBe('alpha');
      expect(getReleaseType('2.0.0-alpha.0')).toBe('alpha');
    });

    test('identifies beta releases', () => {
      expect(getReleaseType('1.2.3-beta.1')).toBe('beta');
      expect(getReleaseType('2.0.0-beta.5')).toBe('beta');
    });

    test('identifies rc releases', () => {
      expect(getReleaseType('1.2.3-rc.1')).toBe('rc');
      expect(getReleaseType('2.0.0-rc.0')).toBe('rc');
    });
  });

  describe('getReleasesToCleanup', () => {
    const mockReleases: ReleaseInfo[] = [
      { id: 1, tagName: 'v1.0.0', publishedAt: '2024-01-01T00:00:00Z', prerelease: false },
      { id: 2, tagName: 'v1.0.1', publishedAt: '2024-01-02T00:00:00Z', prerelease: false },
      { id: 3, tagName: 'v1.0.2', publishedAt: '2024-01-03T00:00:00Z', prerelease: false },
      { id: 4, tagName: 'v1.1.0-dev.abc', publishedAt: '2024-01-04T00:00:00Z', prerelease: true },
      { id: 5, tagName: 'v1.1.0-dev.def', publishedAt: '2024-01-05T00:00:00Z', prerelease: true },
      { id: 6, tagName: 'v1.1.0-alpha.1', publishedAt: '2024-01-06T00:00:00Z', prerelease: true },
    ];

    test('returns empty array when keep is 0 (keep all)', () => {
      const toCleanup = getReleasesToCleanup(mockReleases, 'stable', 'v', 0);
      expect(toCleanup).toEqual([]);
    });

    test('returns empty array when releases count <= keep', () => {
      const toCleanup = getReleasesToCleanup(mockReleases, 'stable', 'v', 5);
      expect(toCleanup).toEqual([]);
    });

    test('returns oldest releases for cleanup when exceeds keep', () => {
      const toCleanup = getReleasesToCleanup(mockReleases, 'stable', 'v', 2);

      // Should return the oldest stable release (v1.0.0)
      expect(toCleanup).toHaveLength(1);
      expect(toCleanup[0]?.tagName).toBe('v1.0.0');
    });

    test('filters by release type correctly', () => {
      const devToCleanup = getReleasesToCleanup(mockReleases, 'dev', 'v', 1);

      // Should return oldest dev release
      expect(devToCleanup).toHaveLength(1);
      expect(devToCleanup[0]?.tagName).toBe('v1.1.0-dev.abc');
    });

    test('handles empty releases array', () => {
      const toCleanup = getReleasesToCleanup([], 'stable', 'v', 5);
      expect(toCleanup).toEqual([]);
    });

    test('handles releases without matching type', () => {
      const toCleanup = getReleasesToCleanup(mockReleases, 'beta', 'v', 1);
      expect(toCleanup).toEqual([]);
    });

    test('works without tag prefix', () => {
      const releasesNoPrefix: ReleaseInfo[] = [
        { id: 1, tagName: '1.0.0', publishedAt: '2024-01-01T00:00:00Z', prerelease: false },
        { id: 2, tagName: '1.0.1', publishedAt: '2024-01-02T00:00:00Z', prerelease: false },
      ];

      const toCleanup = getReleasesToCleanup(releasesNoPrefix, 'stable', '', 1);
      expect(toCleanup).toHaveLength(1);
      expect(toCleanup[0]?.tagName).toBe('1.0.0');
    });
  });

  describe('getTagsToCleanup', () => {
    test('returns empty array when keep is 0 (keep all)', () => {
      const tags = ['v1.0.0', 'v1.0.1', 'v1.0.2'];
      const toCleanup = getTagsToCleanup(tags, 0);
      expect(toCleanup).toEqual([]);
    });

    test('returns empty array when tags count <= keep', () => {
      const tags = ['v1.0.0', 'v1.0.1'];
      const toCleanup = getTagsToCleanup(tags, 5);
      expect(toCleanup).toEqual([]);
    });

    test('returns older tags for cleanup when exceeds keep', () => {
      const tags = ['v1.0.0', 'v1.0.1', 'v1.0.2', 'v1.1.0'];
      const toCleanup = getTagsToCleanup(tags, 2);

      // After reverse sort: v1.1.0, v1.0.2, v1.0.1, v1.0.0
      // Keep 2 means cleanup: v1.0.1, v1.0.0
      expect(toCleanup).toHaveLength(2);
      expect(toCleanup).toContain('v1.0.1');
      expect(toCleanup).toContain('v1.0.0');
    });

    test('handles empty tags array', () => {
      const toCleanup = getTagsToCleanup([], 5);
      expect(toCleanup).toEqual([]);
    });

    test('handles dev tags with timestamps', () => {
      const tags = [
        'v1.0.0-dev.20240101',
        'v1.0.0-dev.20240102',
        'v1.0.0-dev.20240103',
        'v1.0.0-dev.20240104',
      ];
      const toCleanup = getTagsToCleanup(tags, 2);

      // After reverse sort, older ones should be cleaned
      expect(toCleanup).toHaveLength(2);
    });
  });
});

describe('cleanup config application', () => {
  test('applies defaults correctly', async () => {
    // Import applyDefaults to test cleanup config defaults
    const { applyDefaults } = await import('../../../src/config/loader.js');

    const config = applyDefaults({});

    // Cleanup should be disabled by default
    expect(config.cleanup.enabled).toBe(false);

    // All type configs should have defaults
    expect(config.cleanup.dev.tags).toBe(false);
    expect(config.cleanup.dev.releases).toBe(false);
    expect(config.cleanup.dev.published).toBe(false);
    expect(config.cleanup.dev.keep).toBe(10);

    // Stable should have keep: 0 (keep all)
    expect(config.cleanup.stable.keep).toBe(0);
  });

  test('all shorthand expands to tags, releases, published', async () => {
    const { applyDefaults } = await import('../../../src/config/loader.js');

    const config = applyDefaults({
      cleanup: {
        enabled: true,
        dev: {
          all: true,
          keep: 5,
        },
      },
    });

    expect(config.cleanup.enabled).toBe(true);
    expect(config.cleanup.dev.tags).toBe(true);
    expect(config.cleanup.dev.releases).toBe(true);
    expect(config.cleanup.dev.published).toBe(true);
    expect(config.cleanup.dev.keep).toBe(5);
  });

  test('individual settings override all shorthand', async () => {
    const { applyDefaults } = await import('../../../src/config/loader.js');

    const config = applyDefaults({
      cleanup: {
        enabled: true,
        dev: {
          all: true,
          published: false, // Explicitly disable published
          keep: 10,
        },
      },
    });

    expect(config.cleanup.dev.tags).toBe(true);
    expect(config.cleanup.dev.releases).toBe(true);
    expect(config.cleanup.dev.published).toBe(false); // Should be false
  });

  test('preserves per-type configuration', async () => {
    const { applyDefaults } = await import('../../../src/config/loader.js');

    const config = applyDefaults({
      cleanup: {
        enabled: true,
        dev: { all: true, keep: 20 },
        alpha: { tags: true, releases: true, keep: 10 },
        beta: { tags: true, keep: 5 },
        stable: { tags: false, releases: false, keep: 0 },
      },
    });

    expect(config.cleanup.dev.keep).toBe(20);
    expect(config.cleanup.alpha.tags).toBe(true);
    expect(config.cleanup.alpha.releases).toBe(true);
    expect(config.cleanup.alpha.published).toBe(false);
    expect(config.cleanup.beta.tags).toBe(true);
    expect(config.cleanup.beta.releases).toBe(false);
    expect(config.cleanup.stable.keep).toBe(0);
  });
});

describe('ecosystem unpublish support', () => {
  test('npm ecosystem supports unpublish', async () => {
    const { NpmEcosystem } = await import('../../../src/ecosystems/npm.js');
    const npm = new NpmEcosystem();

    expect(npm.supportsUnpublish).toBe(true);
    expect(npm.unpublish).toBeDefined();
  });

  test('python ecosystem supports unpublish', async () => {
    const { PythonEcosystem } = await import('../../../src/ecosystems/python.js');
    const python = new PythonEcosystem();

    expect(python.supportsUnpublish).toBe(true);
    expect(python.unpublish).toBeDefined();
  });

  test('docker ecosystem supports unpublish', async () => {
    const { DockerEcosystem } = await import('../../../src/ecosystems/docker.js');
    const docker = new DockerEcosystem();

    expect(docker.supportsUnpublish).toBe(true);
    expect(docker.unpublish).toBeDefined();
  });

  test('cargo ecosystem does not support unpublish', async () => {
    const { CargoEcosystem } = await import('../../../src/ecosystems/cargo.js');
    const cargo = new CargoEcosystem();

    // Cargo only supports yank, not true unpublish
    expect(cargo.supportsUnpublish).toBeUndefined();
    expect(cargo.unpublish).toBeUndefined();
  });

  test('go ecosystem does not support unpublish', async () => {
    const { GoEcosystem } = await import('../../../src/ecosystems/go.js');
    const go = new GoEcosystem();

    // Go uses git tags, not a package registry
    expect(go.supportsUnpublish).toBeUndefined();
    expect(go.unpublish).toBeUndefined();
  });

  test('composer ecosystem does not support unpublish', async () => {
    const { ComposerEcosystem } = await import('../../../src/ecosystems/composer.js');
    const composer = new ComposerEcosystem();

    // Packagist doesn't support programmatic deletion
    expect(composer.supportsUnpublish).toBeUndefined();
    expect(composer.unpublish).toBeUndefined();
  });
});
