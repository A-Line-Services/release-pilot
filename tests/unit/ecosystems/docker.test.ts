/**
 * Tests for Docker ecosystem implementation
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DockerEcosystem, type DockerEcosystemContext } from '../../../src/ecosystems/docker.js';

const TEST_DIR = join(import.meta.dir, '../../fixtures/docker-test');

function createContext(
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

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('properties', () => {
    test('has correct name', () => {
      expect(docker.name).toBe('docker');
    });
  });

  describe('detect', () => {
    test('detects Dockerfile', async () => {
      const projectDir = join(TEST_DIR, 'detect-test');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'Dockerfile'), 'FROM node:20-alpine');

      expect(await docker.detect(projectDir)).toBe(true);
    });

    test('returns false when no Dockerfile', async () => {
      const emptyDir = join(TEST_DIR, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      expect(await docker.detect(emptyDir)).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('returns 0.0.0 (Docker uses image tags)', async () => {
      const projectDir = join(TEST_DIR, 'read-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'Dockerfile'), 'FROM node:20-alpine');

      const version = await docker.readVersion(createContext(projectDir));

      // Docker uses image tags for versioning
      expect(version).toBe('0.0.0');
    });
  });

  describe('writeVersion', () => {
    test('is a no-op (Docker uses image tags)', async () => {
      const projectDir = join(TEST_DIR, 'write-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'Dockerfile'), 'FROM node:20-alpine');

      // This should not throw
      await docker.writeVersion(createContext(projectDir), '2.0.0');
    });
  });

  describe('getVersionFiles', () => {
    test('returns Dockerfile by default', async () => {
      const projectDir = join(TEST_DIR, 'version-files');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'Dockerfile'), 'FROM node:20-alpine');

      const files = await docker.getVersionFiles(createContext(projectDir));

      expect(files).toContain('Dockerfile');
    });

    test('returns custom dockerfile from config', async () => {
      const projectDir = join(TEST_DIR, 'custom-dockerfile');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'Dockerfile.prod'), 'FROM node:20-alpine');

      const files = await docker.getVersionFiles(
        createContext(projectDir, {
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
      const projectDir = join(TEST_DIR, 'no-config');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'Dockerfile'), 'FROM node:20-alpine');

      await expect(docker.publish(createContext(projectDir))).rejects.toThrow(
        'Docker configuration is required'
      );
    });

    test('skips in dry run mode', async () => {
      const projectDir = join(TEST_DIR, 'dry-run');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'Dockerfile'), 'FROM node:20-alpine');

      // Should not throw in dry run mode
      await docker.publish(
        createContext(projectDir, {
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
