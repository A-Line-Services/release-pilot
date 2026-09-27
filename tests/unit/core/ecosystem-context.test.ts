/**
 * Tests for createEcosystemContext and docker-related action inputs
 *
 * Verifies that package settings, the release version and the prerelease flag
 * reach the ecosystem publishers, and that docker credentials can come from
 * action inputs.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { applyDefaults } from '../../../src/config/loader.js';
import { DockerEcosystem, type ExecFn } from '../../../src/ecosystems/docker.js';
import { createEcosystemContext, getInputs } from '../../../src/main.js';

const PROJECT_ROOT = join(import.meta.dir, '../../..');

function dockerPackage(docker: Record<string, unknown> = {}) {
  const config = applyDefaults({
    packages: [
      {
        name: 'image',
        ecosystem: 'docker',
        docker: { registry: 'ghcr.io', image: 'org/app', ...docker },
      },
    ],
  });
  return config.packages[0]!;
}

describe('createEcosystemContext', () => {
  test('passes docker config, version and prerelease flag', () => {
    const pkg = dockerPackage();

    const ctx = createEcosystemContext(pkg, {
      dryRun: false,
      version: '2.3.4',
      isPrerelease: false,
    });

    expect(ctx.docker).toEqual(pkg.docker!);
    expect(ctx.version).toBe('2.3.4');
    expect(ctx.isPrerelease).toBe(false);
    expect(ctx.path).toBe('.');
  });

  test('publishing a configured docker package builds the real version', async () => {
    const calls: string[][] = [];
    const exec: ExecFn = async (_cmd, args = []) => {
      calls.push(args);
      return 0;
    };

    const ctx = createEcosystemContext(dockerPackage({ cache: 'gha' }), {
      dryRun: false,
      version: '2.3.4',
      isPrerelease: false,
    });
    await new DockerEcosystem(exec).publish(ctx);

    const build = calls.find((args) => args[0] === 'buildx');
    expect(build).toEqual([
      'buildx',
      'build',
      '-f',
      'Dockerfile',
      '--cache-from',
      'type=gha',
      '--cache-to',
      'type=gha,mode=max',
      '-t',
      'ghcr.io/org/app:latest',
      '-t',
      'ghcr.io/org/app:2.3.4',
      '--push',
      '.',
    ]);
  });
});

describe('getInputs', () => {
  const ENV_KEYS = ['INPUT_GITHUB-TOKEN', 'INPUT_DOCKER-USERNAME', 'INPUT_DOCKER-PASSWORD'];
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    process.env['INPUT_GITHUB-TOKEN'] = 'token';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('reads docker credentials and masks the password', () => {
    process.env['INPUT_DOCKER-USERNAME'] = 'bot';
    process.env['INPUT_DOCKER-PASSWORD'] = 's3cret';
    const write = spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const inputs = getInputs();
      expect(inputs.dockerUsername).toBe('bot');
      expect(inputs.dockerPassword).toBe('s3cret');
      expect(write.mock.calls.map((c) => String(c[0])).join('')).toContain('::add-mask::s3cret');
    } finally {
      write.mockRestore();
    }
  });

  test('leaves docker credentials undefined when not provided', () => {
    const inputs = getInputs();
    expect(inputs.dockerUsername).toBeUndefined();
    expect(inputs.dockerPassword).toBeUndefined();
  });
});

describe('action.yml', () => {
  const action = parseYaml(readFileSync(join(PROJECT_ROOT, 'action.yml'), 'utf-8'));

  test('declares docker credential inputs', () => {
    expect(action.inputs['docker-username']).toBeDefined();
    expect(action.inputs['docker-password']).toBeDefined();
  });

  test('runs on node24', () => {
    expect(action.runs.using).toBe('node24');
  });
});
