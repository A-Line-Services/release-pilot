/**
 * Tests for Docker ecosystem implementation
 */

import { describe, expect, test } from 'bun:test';
import { DockerEcosystem, type DockerEcosystemContext } from '../../../src/ecosystems/docker.js';
import { createTestProject, useTestDir } from '../../helpers/index.js';

/** Create a DockerEcosystemContext for testing */
function createDockerContext(
  path: string,
  options: Partial<DockerEcosystemContext> = {}
): DockerEcosystemContext {
  return {
    path,
    dryRun: false,
    log: () => {},
    ...options,
  };
}

describe('DockerEcosystem', () => {
  const docker = new DockerEcosystem();
  const TEST_DIR = useTestDir('docker-test');

  describe('properties', () => {
    test('has correct name', () => {
      expect(docker.name).toBe('docker');
    });
  });

  describe('detect', () => {
    test('detects Dockerfile', async () => {
      const project = createTestProject(TEST_DIR, 'detect-test').withDockerfile();
      expect(await docker.detect(project.path)).toBe(true);
    });

    test('returns false when no Dockerfile', async () => {
      const project = createTestProject(TEST_DIR, 'empty');
      expect(await docker.detect(project.path)).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('returns 0.0.0 (Docker uses image tags)', async () => {
      const project = createTestProject(TEST_DIR, 'read-version').withDockerfile();

      const version = await docker.readVersion(createDockerContext(project.path));
      // Docker uses image tags for versioning
      expect(version).toBe('0.0.0');
    });
  });

  describe('writeVersion', () => {
    test('is a no-op (Docker uses image tags)', async () => {
      const project = createTestProject(TEST_DIR, 'write-version').withDockerfile();

      // This should not throw
      await docker.writeVersion(createDockerContext(project.path), '2.0.0');
    });
  });

  describe('getVersionFiles', () => {
    test('returns Dockerfile by default', async () => {
      const project = createTestProject(TEST_DIR, 'version-files').withDockerfile();

      const files = await docker.getVersionFiles(createDockerContext(project.path));
      expect(files).toContain('Dockerfile');
    });

    test('returns custom dockerfile from config', async () => {
      const project = createTestProject(TEST_DIR, 'custom-dockerfile').withFile(
        'Dockerfile.prod',
        'FROM node:20-alpine'
      );

      const files = await docker.getVersionFiles(
        createDockerContext(project.path, {
          docker: {
            registry: 'ghcr.io',
            image: 'org/app',
            dockerfile: 'Dockerfile.prod',
            context: '.',
            platforms: [],
            tags: ['{version}'],
            devTags: ['{version}'],
            push: true,
          },
        })
      );

      expect(files).toContain('Dockerfile.prod');
    });
  });

  describe('publish', () => {
    test('throws when docker config is missing', async () => {
      const project = createTestProject(TEST_DIR, 'no-config').withDockerfile();

      await expect(docker.publish(createDockerContext(project.path))).rejects.toThrow(
        'Docker configuration is required'
      );
    });

    test('skips in dry run mode', async () => {
      const project = createTestProject(TEST_DIR, 'dry-run').withDockerfile();

      // Should not throw in dry run mode
      await docker.publish(
        createDockerContext(project.path, {
          dryRun: true,
          docker: {
            registry: 'ghcr.io',
            image: 'org/app',
            dockerfile: 'Dockerfile',
            context: '.',
            platforms: [],
            tags: ['{version}'],
            devTags: ['{version}'],
            push: true,
          },
        })
      );
    });
  });
});
