/**
 * Docker Ecosystem Implementation
 *
 * Handles building and pushing Docker images.
 *
 * @module ecosystems/docker
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecOptions } from '@actions/exec';
import type { ResolvedDockerConfig } from '../config/loader.js';
import type { Ecosystem, EcosystemContext } from './base.js';

/**
 * Command runner signature (matches @actions/exec's exec)
 */
export type ExecFn = (command: string, args?: string[], options?: ExecOptions) => Promise<number>;

const defaultExec: ExecFn = async (command, args, options) => {
  const { exec } = await import('@actions/exec');
  return exec(command, args, options);
};

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
  readonly supportsUnpublish = true;

  /**
   * @param exec - Command runner (defaults to @actions/exec)
   */
  constructor(private readonly exec: ExecFn = defaultExec) {}

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
    const dockerfile = ctx.docker?.dockerfile ?? 'Dockerfile';
    return [dockerfile];
  }

  /**
   * Build and push Docker image
   */
  async publish(ctx: EcosystemContext): Promise<void> {
    const config = ctx.docker;

    if (!config) {
      throw new Error('Docker configuration is required');
    }

    if (!ctx.version) {
      throw new Error('Docker publish requires the release version');
    }

    const tags = this.buildTags(config, ctx.version, ctx.isPrerelease ?? false);
    const imageNames = config.registries.map((registry) => `${registry}/${config.image}`);
    const imageRefs = imageNames.flatMap((name) => tags.map((tag) => `${name}:${tag}`));

    if (ctx.dryRun) {
      ctx.log(`[dry-run] Would build and push Docker image: ${imageRefs.join(', ')}`);
      return;
    }

    // Login to registry if credentials provided; otherwise rely on an existing
    // login (e.g. docker/login-action earlier in the workflow)
    const { username, password } = this.credentials(ctx, config);
    const [registry] = config.registries;
    if (username && password && registry && config.registries.length === 1) {
      await this.exec('docker', ['login', registry, '-u', username, '--password-stdin'], {
        input: Buffer.from(password),
        cwd: ctx.path,
      });
      ctx.log(`Logged in to ${registry}`);
    } else if (username && password) {
      ctx.log(
        'Skipping docker login: credentials only apply to a single registry. Log in to each registry beforehand (e.g. docker/login-action).'
      );
    }

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

    // Add build cache
    if (config.cache?.from) {
      buildArgs.push('--cache-from', config.cache.from);
    }
    if (config.cache?.to) {
      buildArgs.push('--cache-to', config.cache.to);
    }

    // Add tags
    for (const ref of imageRefs) {
      buildArgs.push('-t', ref);
    }

    // Push if enabled
    if (config.push) {
      buildArgs.push('--push');
    }

    // Add context
    buildArgs.push(config.context ?? ctx.path);

    // Run build (env is inherited; type=gha cache needs ACTIONS_RESULTS_URL etc.)
    await this.exec('docker', buildArgs, { cwd: ctx.path });

    ctx.log(`Built and pushed ${imageNames.join(', ')} with tags: ${tags.join(', ')}`);
  }

  /**
   * Registry credentials: config values win, action inputs are the fallback
   */
  private credentials(
    ctx: EcosystemContext,
    config: ResolvedDockerConfig
  ): { username?: string; password?: string } {
    return {
      username: config.username ?? ctx.registry?.dockerUsername,
      password: config.password ?? ctx.registry?.dockerPassword,
    };
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

  /**
   * Delete a Docker image tag from every configured registry
   *
   * Supports:
   * - GitHub Container Registry (ghcr.io)
   * - Docker Hub (docker.io)
   * - Google Container Registry (gcr.io)
   * - AWS ECR (*.ecr.*.amazonaws.com)
   *
   * @param ctx - Ecosystem context
   * @param version - Version/tag to delete
   * @returns true if deleted successfully
   */
  async unpublish(ctx: EcosystemContext, version: string): Promise<boolean> {
    const config = ctx.docker;

    if (!config) {
      ctx.log('Cannot delete image: Docker configuration is required');
      return false;
    }

    if (ctx.dryRun) {
      ctx.log(`[dry-run] Would delete image tag ${config.image}:${version}`);
      return true;
    }

    const tag = version.replace(/^v/, ''); // Remove v prefix for tag

    // Try every registry, even after a failure
    const results: boolean[] = [];
    for (const registry of config.registries) {
      results.push(await this.deleteTag(ctx, config, registry, tag));
    }
    return results.every(Boolean);
  }

  /**
   * Delete a tag from one registry
   */
  private async deleteTag(
    ctx: EcosystemContext,
    config: ResolvedDockerConfig,
    registry: string,
    tag: string
  ): Promise<boolean> {
    try {
      // Route to appropriate registry handler
      if (registry === 'ghcr.io') {
        return await this.deleteFromGhcr(ctx, config.image, tag);
      }

      if (registry === 'docker.io') {
        return await this.deleteFromDockerHub(
          ctx,
          config.image,
          tag,
          this.credentials(ctx, config)
        );
      }

      if (registry.includes('gcr.io')) {
        return await this.deleteFromGcr(ctx, registry, config.image, tag);
      }

      if (registry.includes('.ecr.') && registry.includes('.amazonaws.com')) {
        return await this.deleteFromEcr(ctx, registry, config.image, tag);
      }

      // Generic OCI registry - try Docker Registry HTTP API V2
      return await this.deleteFromGenericRegistry(
        ctx,
        registry,
        config.image,
        tag,
        this.credentials(ctx, config)
      );
    } catch (error) {
      ctx.log(`Failed to delete ${registry}/${config.image}:${tag}: ${error}`);
      return false;
    }
  }

  /**
   * Delete image from GitHub Container Registry using gh CLI
   */
  private async deleteFromGhcr(
    ctx: EcosystemContext,
    image: string,
    tag: string
  ): Promise<boolean> {
    try {
      // gh api -X DELETE /user/packages/container/{package_name}/versions/{version_id}
      // First, we need to get the version ID for the tag
      // This requires listing versions and finding the one with our tag

      // For ghcr.io, the image format is: owner/package-name
      const parts = image.split('/');
      if (parts.length < 2) {
        ctx.log('Invalid ghcr.io image format. Expected: owner/package-name');
        return false;
      }

      const owner = parts[0];
      const packageName = parts.slice(1).join('/');

      // Use gh CLI to delete the package version
      // Note: This requires the package to be owned by the authenticated user/org
      await this.exec(
        'gh',
        [
          'api',
          '-X',
          'DELETE',
          `/users/${owner}/packages/container/${encodeURIComponent(packageName)}/versions`,
          '-f',
          `tag=${tag}`,
        ],
        { cwd: ctx.path }
      );

      ctx.log(`Deleted ghcr.io/${image}:${tag}`);
      return true;
    } catch (error) {
      // Try organization endpoint if user endpoint fails
      try {
        const parts = image.split('/');
        const org = parts[0];
        const packageName = parts.slice(1).join('/');

        await this.exec(
          'gh',
          [
            'api',
            '-X',
            'DELETE',
            `/orgs/${org}/packages/container/${encodeURIComponent(packageName)}/versions`,
            '-f',
            `tag=${tag}`,
          ],
          { cwd: ctx.path }
        );

        ctx.log(`Deleted ghcr.io/${image}:${tag}`);
        return true;
      } catch {
        ctx.log(`Failed to delete from ghcr.io: ${error}`);
        return false;
      }
    }
  }

  /**
   * Delete image from Docker Hub using the Hub API
   */
  private async deleteFromDockerHub(
    ctx: EcosystemContext,
    image: string,
    tag: string,
    { username, password }: { username?: string; password?: string }
  ): Promise<boolean> {
    if (!username || !password) {
      ctx.log('Cannot delete from Docker Hub: username and password required');
      return false;
    }

    try {
      // Get JWT token
      const loginResponse = await fetch('https://hub.docker.com/v2/users/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!loginResponse.ok) {
        ctx.log('Failed to authenticate with Docker Hub');
        return false;
      }

      const { token } = (await loginResponse.json()) as { token: string };

      // Delete the tag
      // DELETE https://hub.docker.com/v2/repositories/{namespace}/{repository}/tags/{tag}/
      const deleteResponse = await fetch(
        `https://hub.docker.com/v2/repositories/${image}/tags/${tag}/`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (deleteResponse.ok || deleteResponse.status === 204) {
        ctx.log(`Deleted docker.io/${image}:${tag}`);
        return true;
      }

      ctx.log(`Failed to delete from Docker Hub: HTTP ${deleteResponse.status}`);
      return false;
    } catch (error) {
      ctx.log(`Failed to delete from Docker Hub: ${error}`);
      return false;
    }
  }

  /**
   * Delete image from Google Container Registry using gcloud
   */
  private async deleteFromGcr(
    ctx: EcosystemContext,
    registry: string,
    image: string,
    tag: string
  ): Promise<boolean> {
    try {
      const fullImage = `${registry}/${image}:${tag}`;
      await this.exec(
        'gcloud',
        ['container', 'images', 'delete', fullImage, '--quiet', '--force-delete-tags'],
        {
          cwd: ctx.path,
        }
      );

      ctx.log(`Deleted ${fullImage}`);
      return true;
    } catch (error) {
      ctx.log(`Failed to delete from GCR: ${error}`);
      return false;
    }
  }

  /**
   * Delete image from AWS ECR using aws CLI
   */
  private async deleteFromEcr(
    ctx: EcosystemContext,
    registry: string,
    image: string,
    tag: string
  ): Promise<boolean> {
    try {
      // Extract region from registry URL
      // Format: {account}.dkr.ecr.{region}.amazonaws.com
      const regionMatch = registry.match(/\.ecr\.([^.]+)\.amazonaws\.com/);
      const region = regionMatch?.[1];

      const args = [
        'ecr',
        'batch-delete-image',
        '--repository-name',
        image,
        '--image-ids',
        `imageTag=${tag}`,
      ];

      if (region) {
        args.push('--region', region);
      }

      await this.exec('aws', args, { cwd: ctx.path });

      ctx.log(`Deleted ${registry}/${image}:${tag}`);
      return true;
    } catch (error) {
      ctx.log(`Failed to delete from ECR: ${error}`);
      return false;
    }
  }

  /**
   * Delete image from a generic OCI registry using Docker Registry HTTP API V2
   */
  private async deleteFromGenericRegistry(
    ctx: EcosystemContext,
    registry: string,
    image: string,
    tag: string,
    { username, password }: { username?: string; password?: string }
  ): Promise<boolean> {
    try {
      // Get manifest digest first
      const manifestUrl = `https://${registry}/v2/${image}/manifests/${tag}`;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.docker.distribution.manifest.v2+json',
      };

      // Add auth if provided
      if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        headers.Authorization = `Basic ${auth}`;
      }

      const manifestResponse = await fetch(manifestUrl, { headers });

      if (!manifestResponse.ok) {
        ctx.log(`Failed to get manifest for ${image}:${tag}`);
        return false;
      }

      const digest = manifestResponse.headers.get('Docker-Content-Digest');
      if (!digest) {
        ctx.log('No digest found in manifest response');
        return false;
      }

      // Delete by digest
      const deleteUrl = `https://${registry}/v2/${image}/manifests/${digest}`;
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers,
      });

      if (deleteResponse.ok || deleteResponse.status === 202) {
        ctx.log(`Deleted ${registry}/${image}:${tag}`);
        return true;
      }

      ctx.log(`Failed to delete from registry: HTTP ${deleteResponse.status}`);
      return false;
    } catch (error) {
      ctx.log(`Failed to delete from registry: ${error}`);
      return false;
    }
  }
}
