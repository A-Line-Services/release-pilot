/**
 * NPM Ecosystem Implementation
 *
 * Handles version management for Node.js packages using package.json.
 *
 * @module ecosystems/npm
 */

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BaseFileEcosystem, type EcosystemContext } from './base.js';

/**
 * NPM ecosystem implementation for Node.js packages
 *
 * Supports:
 * - Reading/writing version in package.json
 * - Detecting package-lock.json and npm-shrinkwrap.json
 * - Publishing via `npm publish`
 * - Automatic .npmrc configuration when token is provided
 *
 * @example
 * const npm = new NpmEcosystem();
 * const version = await npm.readVersion(ctx);
 * await npm.writeVersion(ctx, '1.2.0');
 */
export class NpmEcosystem extends BaseFileEcosystem {
  readonly name = 'npm';

  constructor() {
    super({
      manifestFile: 'package.json',
      lockFiles: ['package-lock.json'],
    });
  }

  /**
   * Get files that should be committed after version bump
   *
   * Overrides base to also check for npm-shrinkwrap.json
   */
  async getVersionFiles(ctx: EcosystemContext): Promise<string[]> {
    const files = await super.getVersionFiles(ctx);

    // Also check for shrinkwrap
    const shrinkwrap = join(ctx.path, 'npm-shrinkwrap.json');
    if (existsSync(shrinkwrap)) {
      files.push('npm-shrinkwrap.json');
    }

    return files;
  }

  /**
   * Publish package to npm registry
   *
   * If registry.npmToken is provided, configures .npmrc automatically.
   * Otherwise, assumes credentials are already configured.
   */
  async publish(ctx: EcosystemContext): Promise<void> {
    if (ctx.dryRun) {
      ctx.log('[dry-run] Would run: npm publish');
      return;
    }

    // Configure .npmrc if token is provided
    if (ctx.registry?.npmToken) {
      await this.configureNpmrc(ctx);
    }

    const { exec } = await import('@actions/exec');

    await exec('npm', ['publish'], {
      cwd: ctx.path,
    });

    ctx.log('Published to npm');
  }

  /**
   * Update lockfile after version change
   */
  async postVersionUpdate(ctx: EcosystemContext): Promise<void> {
    if (ctx.dryRun) {
      ctx.log('[dry-run] Would run: npm install --package-lock-only');
      return;
    }

    // Only update lockfile if it exists
    const lockFile = join(ctx.path, 'package-lock.json');
    if (!existsSync(lockFile)) {
      return;
    }

    const { exec } = await import('@actions/exec');

    await exec('npm', ['install', '--package-lock-only'], {
      cwd: ctx.path,
    });

    ctx.log('Updated package-lock.json');
  }

  /**
   * Parse version from package.json content
   */
  protected parseVersion(content: string): string | null {
    const pkg = JSON.parse(content);
    return pkg.version ?? null;
  }

  /**
   * Update version in package.json content
   */
  protected updateVersion(content: string, version: string): string {
    const pkg = JSON.parse(content);
    const indent = this.detectIndent(content);
    pkg.version = version;
    return `${JSON.stringify(pkg, null, indent)}\n`;
  }

  /**
   * Configure .npmrc for authentication
   *
   * Creates a project-level .npmrc with the auth token.
   * Supports custom registries (e.g., GitHub Packages).
   */
  private async configureNpmrc(ctx: EcosystemContext): Promise<void> {
    const token = ctx.registry?.npmToken;
    if (!token) {
      return;
    }

    const registry = ctx.registry?.npmRegistry || 'https://registry.npmjs.org';
    const registryHost = new URL(registry).host;

    // Format: //registry.npmjs.org/:_authToken=TOKEN
    const npmrcContent = `//${registryHost}/:_authToken=${token}\n`;
    const npmrcPath = join(ctx.path, '.npmrc');

    writeFileSync(npmrcPath, npmrcContent);
    ctx.log(`Configured .npmrc for ${registryHost}`);
  }

  /**
   * Detect indentation used in JSON file
   */
  private detectIndent(content: string): number {
    // Look for common indent patterns
    const match = content.match(/^(\s+)"/m);
    if (match?.[1]) {
      return match[1].length;
    }
    return 2; // Default to 2 spaces
  }
}
