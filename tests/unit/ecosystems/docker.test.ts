/**
 * Tests for Docker ecosystem implementation
 */

import { describe, expect, test } from 'bun:test';
import type { ResolvedDockerConfig } from '../../../src/config/loader.js';
import type { EcosystemContext } from '../../../src/ecosystems/base.js';
import { DockerEcosystem, type ExecFn } from '../../../src/ecosystems/docker.js';
import { createTestProject, useTestDir } from '../../helpers/index.js';

/** Create an EcosystemContext for docker tests */
function createDockerContext(
  path: string,
  options: Partial<EcosystemContext> = {}
): EcosystemContext {
  return {
    path,
    dryRun: false,
    log: () => {},
    ...options,
  };
}

/** Resolved docker config with sensible test defaults */
function dockerConfig(overrides: Partial<ResolvedDockerConfig> = {}): ResolvedDockerConfig {
  return {
    registry: 'ghcr.io',
    image: 'org/app',
    dockerfile: 'Dockerfile',
    tags: ['latest', '{version}'],
    devTags: ['dev', '{version}'],
    push: true,
    ...overrides,
  };
}

interface ExecCall {
  command: string;
  args: string[];
  options?: Parameters<ExecFn>[2];
}

/** Exec stub that records every call instead of running it */
function recordingExec(): { exec: ExecFn; calls: ExecCall[] } {
  const calls: ExecCall[] = [];
  const exec: ExecFn = async (command, args = [], options) => {
    calls.push({ command, args, options });
    return 0;
  };
  return { exec, calls };
}

function buildCall(calls: ExecCall[]): ExecCall {
  const call = calls.find((c) => c.args[0] === 'buildx' && c.args[1] === 'build');
  if (!call) throw new Error('docker buildx build was not called');
  return call;
}

/** Values following each occurrence of a flag */
function flagValues(args: string[], flag: string): string[] {
  return args.flatMap((arg, i) => (arg === flag ? [args[i + 1]!] : []));
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

    test('dry run logs the planned build without running docker', async () => {
      const { exec, calls } = recordingExec();
      const logs: string[] = [];

      await new DockerEcosystem(exec).publish(
        createDockerContext('/repo', {
          dryRun: true,
          version: '1.4.0',
          docker: dockerConfig(),
          log: (msg) => logs.push(msg),
        })
      );

      expect(calls).toHaveLength(0);
      expect(logs.join('\n')).toContain('ghcr.io/org/app:1.4.0');
    });

    test('builds with tags from the release version, push, dockerfile and context', async () => {
      const { exec, calls } = recordingExec();

      await new DockerEcosystem(exec).publish(
        createDockerContext('/repo', {
          version: '1.4.0',
          isPrerelease: false,
          docker: dockerConfig({ dockerfile: 'docker/Dockerfile', context: 'app' }),
        })
      );

      const { command, args } = buildCall(calls);
      expect(command).toBe('docker');
      expect(flagValues(args, '-t')).toEqual(['ghcr.io/org/app:latest', 'ghcr.io/org/app:1.4.0']);
      expect(flagValues(args, '-f')).toEqual(['docker/Dockerfile']);
      expect(args).toContain('--push');
      expect(args.at(-1)).toBe('app');
    });

    test('uses devTags for prereleases', async () => {
      const { exec, calls } = recordingExec();

      await new DockerEcosystem(exec).publish(
        createDockerContext('/repo', {
          version: '1.4.0-rc.abc',
          isPrerelease: true,
          docker: dockerConfig(),
        })
      );

      expect(flagValues(buildCall(calls).args, '-t')).toEqual([
        'ghcr.io/org/app:dev',
        'ghcr.io/org/app:1.4.0-rc.abc',
      ]);
    });

    test('falls back to the package path as build context', async () => {
      const { exec, calls } = recordingExec();

      await new DockerEcosystem(exec).publish(
        createDockerContext('/repo', { version: '1.0.0', docker: dockerConfig() })
      );

      expect(buildCall(calls).args.at(-1)).toBe('/repo');
    });

    test('throws when the release version is missing', async () => {
      const { exec, calls } = recordingExec();

      await expect(
        new DockerEcosystem(exec).publish(createDockerContext('/repo', { docker: dockerConfig() }))
      ).rejects.toThrow('version');
      expect(calls).toHaveLength(0);
    });

    test('inherits the process environment (needed for type=gha cache)', async () => {
      const { exec, calls } = recordingExec();

      await new DockerEcosystem(exec).publish(
        createDockerContext('/repo', { version: '1.0.0', docker: dockerConfig() })
      );

      expect(buildCall(calls).options?.env).toBeUndefined();
    });

    describe('cache', () => {
      test('adds no cache flags by default', async () => {
        const { exec, calls } = recordingExec();

        await new DockerEcosystem(exec).publish(
          createDockerContext('/repo', { version: '1.0.0', docker: dockerConfig() })
        );

        const { args } = buildCall(calls);
        expect(args).not.toContain('--cache-from');
        expect(args).not.toContain('--cache-to');
      });

      test('passes resolved cache-from and cache-to', async () => {
        const { exec, calls } = recordingExec();

        await new DockerEcosystem(exec).publish(
          createDockerContext('/repo', {
            version: '1.0.0',
            docker: dockerConfig({
              cache: { from: 'type=gha', to: 'type=gha,mode=max' },
            }),
          })
        );

        const { args } = buildCall(calls);
        expect(flagValues(args, '--cache-from')).toEqual(['type=gha']);
        expect(flagValues(args, '--cache-to')).toEqual(['type=gha,mode=max']);
      });

      test('supports only cache-from', async () => {
        const { exec, calls } = recordingExec();

        await new DockerEcosystem(exec).publish(
          createDockerContext('/repo', {
            version: '1.0.0',
            docker: dockerConfig({ cache: { from: 'type=registry,ref=ghcr.io/org/app:cache' } }),
          })
        );

        const { args } = buildCall(calls);
        expect(flagValues(args, '--cache-from')).toEqual([
          'type=registry,ref=ghcr.io/org/app:cache',
        ]);
        expect(args).not.toContain('--cache-to');
      });
    });

    describe('login', () => {
      test('skips docker login when no credentials are set', async () => {
        const { exec, calls } = recordingExec();

        await new DockerEcosystem(exec).publish(
          createDockerContext('/repo', { version: '1.0.0', docker: dockerConfig() })
        );

        expect(calls.some((c) => c.args[0] === 'login')).toBe(false);
        expect(calls).toHaveLength(1);
      });

      test('logs in with credentials from the config', async () => {
        const { exec, calls } = recordingExec();

        await new DockerEcosystem(exec).publish(
          createDockerContext('/repo', {
            version: '1.0.0',
            docker: dockerConfig({ username: 'cfg-user', password: 'cfg-pass' }),
            registry: { dockerUsername: 'input-user', dockerPassword: 'input-pass' },
          })
        );

        const login = calls[0]!;
        expect(login.args).toEqual(['login', 'ghcr.io', '-u', 'cfg-user', '--password-stdin']);
        expect(login.options?.input?.toString()).toBe('cfg-pass');
      });

      test('falls back to credentials from action inputs', async () => {
        const { exec, calls } = recordingExec();

        await new DockerEcosystem(exec).publish(
          createDockerContext('/repo', {
            version: '1.0.0',
            docker: dockerConfig(),
            registry: { dockerUsername: 'input-user', dockerPassword: 'input-pass' },
          })
        );

        const login = calls[0]!;
        expect(login.args).toEqual(['login', 'ghcr.io', '-u', 'input-user', '--password-stdin']);
        expect(login.options?.input?.toString()).toBe('input-pass');
        expect(buildCall(calls)).toBeDefined();
      });
    });
  });
});
