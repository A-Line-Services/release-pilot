/**
 * Docker Ecosystem Implementation
 *
 * Handles building and pushing Docker images.
 *
 * @module ecosystems/docker
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ResolvedDockerConfig } from '../config/loader.js';
import type { Ecosystem, EcosystemContext } from './base.js';

/**
 * Extended context for Docker ecosystem
 */
export interface DockerEcosystemContext extends EcosystemContext {
  /** Docker-specific configuration */
  docker?: ResolvedDockerConfig;
  /** Current version being released */
  version?: string;
  /** Whether this is a dev/prerelease */
  isPrerelease?: boolean;
}

/**
 * Docker ecosystem implementation
 *
 * Supports:
 * - Building Docker images
 * - Multi-platform builds (linux/amd64, linux/arm64, etc.)
 * - Multiple registries
 * - Tag templates with version placeholders
 *
 * @example
 * const docker = new DockerEcosystem();
 * await docker.publish(ctx);
 */
export class DockerEcosystem implements Ecosystem {
  readonly name = 'docker';

  /**
   * Detect if this is a Docker project
   */
  async detect(path: string): Promise<boolean> {
    return existsSync(join(path, 'Dockerfile'));
  }

  /**
   * Read version - Docker doesn't have a version file
   */
  async readVersion(ctx: EcosystemContext): Promise<string> {
    ctx.log('Docker images use tags for versioning');
    return '0.0.0';
  }

  /**
   * Write version - No-op for Docker
   */
  async writeVersion(ctx: EcosystemContext, version: string): Promise<void> {
    ctx.log(`Docker image will be tagged with version ${version}`);
  }

  /**
   * Get version files - returns Dockerfile for tracking
   */
  async getVersionFiles(ctx: EcosystemContext): Promise<string[]> {
    const dockerCtx = ctx as DockerEcosystemContext;
    const dockerfile = dockerCtx.docker?.dockerfile ?? 'Dockerfile';
    return [dockerfile];
  }

  /**
   * Build and push Docker image
   */
  async publish(ctx: EcosystemContext): Promise<void> {
    const dockerCtx = ctx as DockerEcosystemContext;
    const config = dockerCtx.docker;

    if (!config) {
      throw new Error('Docker configuration is required');
    }

    if (ctx.dryRun) {
      ctx.log('[dry-run] Would build and push Docker image');
      return;
    }

    const { exec } = await import('@actions/exec');

    // Login to registry if credentials provided
    if (config.username && config.password) {
      await exec('docker', ['login', config.registry, '-u', config.username, '--password-stdin'], {
        input: Buffer.from(config.password),
        cwd: ctx.path,
      });
      ctx.log(`Logged in to ${config.registry}`);
    }

    // Build tags
    const tags = this.buildTags(
      config,
      dockerCtx.version ?? '0.0.0',
      dockerCtx.isPrerelease ?? false
    );
    const fullImageName = `${config.registry}/${config.image}`;

    // Build command args
    const buildArgs: string[] = ['buildx', 'build'];

    // Add dockerfile
    buildArgs.push('-f', config.dockerfile);

    // Add build args
    if (config.buildArgs) {
      for (const [key, value] of Object.entries(config.buildArgs)) {
        buildArgs.push('--build-arg', `${key}=${value}`);
      }
    }

    // Add platforms for multi-arch
    if (config.platforms && config.platforms.length > 0) {
      buildArgs.push('--platform', config.platforms.join(','));
    }

    // Add target if specified
    if (config.target) {
      buildArgs.push('--target', config.target);
    }

    // Add tags
    for (const tag of tags) {
      buildArgs.push('-t', `${fullImageName}:${tag}`);
    }

    // Push if enabled
    if (config.push) {
      buildArgs.push('--push');
    }

    // Add context
    buildArgs.push(config.context ?? ctx.path);

    // Run build
    await exec('docker', buildArgs, { cwd: ctx.path });

    ctx.log(`Built and pushed ${fullImageName} with tags: ${tags.join(', ')}`);
  }

  /**
   * Build tags from templates
   */
  private buildTags(
    config: ResolvedDockerConfig,
    version: string,
    isPrerelease: boolean
  ): string[] {
    const templates = isPrerelease ? config.devTags : config.tags;
    const parts = this.parseVersion(version);

    return templates.map((template) =>
      template
        .replace(/\{version\}/g, parts.version)
        .replace(/\{major\}/g, parts.major)
        .replace(/\{minor\}/g, parts.minor)
        .replace(/\{patch\}/g, parts.patch)
    );
  }

  /**
   * Parse version into parts
   */
  private parseVersion(version: string): {
    version: string;
    major: string;
    minor: string;
    patch: string;
  } {
    const clean = version.replace(/^v/, '');
    const match = clean.match(/^(\d+)\.(\d+)\.(\d+)/);

    if (!match) {
      return { version: clean, major: '0', minor: '0', patch: '0' };
    }

    return {
      version: clean,
      major: match[1]!,
      minor: match[2]!,
      patch: match[3]!,
    };
  }
}
