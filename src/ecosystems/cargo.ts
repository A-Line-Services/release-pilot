/**
 * Cargo (Rust) Ecosystem Implementation
 *
 * Handles version management for Rust crates using Cargo.toml.
 * Supports both package-level and workspace-level versioning.
 *
 * @module ecosystems/cargo
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Ecosystem, EcosystemContext } from './base.js';

/**
 * Cargo ecosystem implementation for Rust crates
 *
 * Supports:
 * - Reading/writing version in Cargo.toml
 * - Workspace version inheritance
 * - Publishing via `cargo publish`
 *
 * @example
 * const cargo = new CargoEcosystem();
 * const version = await cargo.readVersion(ctx);
 * await cargo.writeVersion(ctx, '1.2.0');
 */
export class CargoEcosystem implements Ecosystem {
  readonly name = 'cargo';

  /**
   * Detect if this is a Cargo project
   *
   * @param path - Directory to check
   * @returns True if Cargo.toml exists
   */
  async detect(path: string): Promise<boolean> {
    try {
      return existsSync(join(path, 'Cargo.toml'));
    } catch {
      return false;
    }
  }

  /**
   * Read version from Cargo.toml
   *
   * Supports both direct version and workspace version inheritance.
   *
   * @param ctx - Ecosystem context
   * @returns Version string
   * @throws Error if version cannot be determined
   */
  async readVersion(ctx: EcosystemContext): Promise<string> {
    const cargoPath = this.getCargoPath(ctx);

    if (!existsSync(cargoPath)) {
      throw new Error(`Cargo.toml not found at ${cargoPath}`);
    }

    const content = readFileSync(cargoPath, 'utf-8');

    // Check for workspace version first
    const workspaceVersion = this.extractWorkspaceVersion(content);
    if (workspaceVersion) {
      return workspaceVersion;
    }

    // Check for package version
    const packageVersion = this.extractPackageVersion(content);
    if (packageVersion) {
      return packageVersion;
    }

    throw new Error(`No version found in ${cargoPath}`);
  }

  /**
   * Write version to Cargo.toml
   *
   * Updates workspace.package.version if present, otherwise package.version.
   *
   * @param ctx - Ecosystem context
   * @param version - New version to write
   */
  async writeVersion(ctx: EcosystemContext, version: string): Promise<void> {
    if (ctx.dryRun) {
      ctx.log(`[dry-run] Would write version ${version} to Cargo.toml`);
      return;
    }

    const cargoPath = this.getCargoPath(ctx);
    let content = readFileSync(cargoPath, 'utf-8');

    // Check if using workspace versioning
    // Using RegExp constructor to avoid eslint no-useless-escape warnings
    if (content.includes('[workspace.package]')) {
      // Update workspace version
      const wsRegex = new RegExp('(\\[workspace\\.package\\][^\\[]*version\\s*=\\s*)"[^"]*"', 's');
      content = content.replace(wsRegex, `$1"${version}"`);
    } else {
      // Update package version
      const pkgRegex = new RegExp('(\\[package\\][^\\[]*version\\s*=\\s*)"[^"]*"', 's');
      content = content.replace(pkgRegex, `$1"${version}"`);
    }

    writeFileSync(cargoPath, content);

    ctx.log(`Updated version to ${version} in ${cargoPath}`);
  }

  /**
   * Get files that should be committed after version bump
   *
   * @param ctx - Ecosystem context
   * @returns List of version-related files
   */
  async getVersionFiles(ctx: EcosystemContext): Promise<string[]> {
    const files = ['Cargo.toml'];

    // Include Cargo.lock if it exists
    const lockFile = join(ctx.path, 'Cargo.lock');
    if (existsSync(lockFile)) {
      files.push('Cargo.lock');
    }

    return files;
  }

  /**
   * Publish crate to crates.io
   *
   * @param ctx - Ecosystem context
   */
  async publish(ctx: EcosystemContext): Promise<void> {
    if (ctx.dryRun) {
      ctx.log('[dry-run] Would run: cargo publish');
      return;
    }

    const { exec } = await import('@actions/exec');

    await exec('cargo', ['publish', '--allow-dirty'], {
      cwd: ctx.path,
    });

    ctx.log('Published to crates.io');
  }

  /**
   * Update Cargo.lock after version change
   *
   * @param ctx - Ecosystem context
   */
  async postVersionUpdate(ctx: EcosystemContext): Promise<void> {
    if (ctx.dryRun) {
      ctx.log('[dry-run] Would run: cargo update --workspace');
      return;
    }

    // Only update if Cargo.lock exists
    const lockFile = join(ctx.path, 'Cargo.lock');
    if (!existsSync(lockFile)) {
      return;
    }

    const { exec } = await import('@actions/exec');

    await exec('cargo', ['update', '--workspace'], {
      cwd: ctx.path,
    });

    ctx.log('Updated Cargo.lock');
  }

  /**
   * Get path to Cargo.toml
   */
  private getCargoPath(ctx: EcosystemContext): string {
    if (ctx.versionFile) {
      return join(ctx.path, ctx.versionFile);
    }
    return join(ctx.path, 'Cargo.toml');
  }

  /**
   * Extract version from [workspace.package] section
   */
  private extractWorkspaceVersion(content: string): string | null {
    const regex = new RegExp('\\[workspace\\.package\\][^\\[]*version\\s*=\\s*"([^"]+)"', 's');
    const match = content.match(regex);
    return match?.[1] ?? null;
  }

  /**
   * Extract version from [package] section
   */
  private extractPackageVersion(content: string): string | null {
    // First check if version uses workspace inheritance
    const wsInheritRegex = new RegExp('\\[package\\][^\\[]*version\\.workspace\\s*=\\s*true', 's');
    if (content.match(wsInheritRegex)) {
      // Fall back to workspace version
      return this.extractWorkspaceVersion(content);
    }

    const regex = new RegExp('\\[package\\][^\\[]*version\\s*=\\s*"([^"]+)"', 's');
    const match = content.match(regex);
    return match?.[1] ?? null;
  }
}
