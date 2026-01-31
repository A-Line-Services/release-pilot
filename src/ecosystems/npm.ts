/**
 * NPM Ecosystem Implementation
 *
 * Handles version management for Node.js packages using package.json.
 *
 * @module ecosystems/npm
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Ecosystem, EcosystemContext } from './base.js';

/**
 * NPM ecosystem implementation for Node.js packages
 *
 * Supports:
 * - Reading/writing version in package.json
 * - Detecting package-lock.json and npm-shrinkwrap.json
 * - Publishing via `npm publish`
 *
 * @example
 * const npm = new NpmEcosystem();
 * const version = await npm.readVersion(ctx);
 * await npm.writeVersion(ctx, '1.2.0');
 */
export class NpmEcosystem implements Ecosystem {
  readonly name = 'npm';

  /**
   * Detect if this is an npm project
   *
   * @param path - Directory to check
   * @returns True if package.json exists
   */
  async detect(path: string): Promise<boolean> {
    try {
      return existsSync(join(path, 'package.json'));
    } catch {
      return false;
    }
  }

  /**
   * Read version from package.json
   *
   * @param ctx - Ecosystem context
   * @returns Version string
   * @throws Error if package.json doesn't exist or has no version
   */
  async readVersion(ctx: EcosystemContext): Promise<string> {
    const packagePath = this.getPackagePath(ctx);

    if (!existsSync(packagePath)) {
      throw new Error(`package.json not found at ${packagePath}`);
    }

    const content = JSON.parse(readFileSync(packagePath, 'utf-8'));

    if (!content.version) {
      throw new Error(`No version field in ${packagePath}`);
    }

    return content.version;
  }

  /**
   * Write version to package.json
   *
   * Preserves existing formatting and all other fields.
   *
   * @param ctx - Ecosystem context
   * @param version - New version to write
   */
  async writeVersion(ctx: EcosystemContext, version: string): Promise<void> {
    if (ctx.dryRun) {
      ctx.log(`[dry-run] Would write version ${version} to package.json`);
      return;
    }

    const packagePath = this.getPackagePath(ctx);
    const rawContent = readFileSync(packagePath, 'utf-8');
    const content = JSON.parse(rawContent);

    // Detect indent from existing file
    const indent = this.detectIndent(rawContent);

    content.version = version;

    writeFileSync(packagePath, JSON.stringify(content, null, indent) + '\n');

    ctx.log(`Updated version to ${version} in ${packagePath}`);
  }

  /**
   * Get files that should be committed after version bump
   *
   * @param ctx - Ecosystem context
   * @returns List of version-related files
   */
  async getVersionFiles(ctx: EcosystemContext): Promise<string[]> {
    const files = ['package.json'];

    // Check for lockfiles
    const lockFile = join(ctx.path, 'package-lock.json');
    if (existsSync(lockFile)) {
      files.push('package-lock.json');
    }

    const shrinkwrap = join(ctx.path, 'npm-shrinkwrap.json');
    if (existsSync(shrinkwrap)) {
      files.push('npm-shrinkwrap.json');
    }

    return files;
  }

  /**
   * Publish package to npm registry
   *
   * @param ctx - Ecosystem context
   */
  async publish(ctx: EcosystemContext): Promise<void> {
    if (ctx.dryRun) {
      ctx.log('[dry-run] Would run: npm publish');
      return;
    }

    const { exec } = await import('@actions/exec');

    await exec('npm', ['publish'], {
      cwd: ctx.path,
    });

    ctx.log('Published to npm');
  }

  /**
   * Update lockfile after version change
   *
   * @param ctx - Ecosystem context
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
   * Get path to package.json
   */
  private getPackagePath(ctx: EcosystemContext): string {
    if (ctx.versionFile) {
      return join(ctx.path, ctx.versionFile);
    }
    return join(ctx.path, 'package.json');
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
