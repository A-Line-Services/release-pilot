/**
 * Cargo (Rust) Ecosystem Implementation
 *
 * Handles version management for Rust crates using Cargo.toml.
 * Supports both package-level and workspace-level versioning.
 *
 * @module ecosystems/cargo
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { BaseFileEcosystem, type EcosystemContext } from './base.js';

/**
 * Cargo ecosystem implementation for Rust crates
 *
 * Supports:
 * - Reading/writing version in Cargo.toml
 * - Workspace version inheritance
 * - Publishing via `cargo publish`
 * - Automatic token configuration via CARGO_REGISTRY_TOKEN
 *
 * @example
 * const cargo = new CargoEcosystem();
 * const version = await cargo.readVersion(ctx);
 * await cargo.writeVersion(ctx, '1.2.0');
 */
export class CargoEcosystem extends BaseFileEcosystem {
  readonly name = 'cargo';

  constructor() {
    super({
      manifestFile: 'Cargo.toml',
      lockFiles: ['Cargo.lock'],
    });
  }

  /**
   * Publish crate to crates.io
   *
   * If registry.cargoToken is provided, passes it via --token flag.
   * Otherwise, assumes credentials are already configured.
   */
  async publish(ctx: EcosystemContext): Promise<void> {
    if (ctx.dryRun) {
      ctx.log('[dry-run] Would run: cargo publish');
      return;
    }

    const { exec } = await import('@actions/exec');

    const args = ['publish', '--allow-dirty'];

    // Add token if provided
    if (ctx.registry?.cargoToken) {
      args.push('--token', ctx.registry.cargoToken);
      ctx.log('Using provided cargo token');
    }

    await exec('cargo', args, {
      cwd: ctx.path,
    });

    ctx.log('Published to crates.io');
  }

  /**
   * Update Cargo.lock after version change
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
   * Parse version from Cargo.toml content
   *
   * Supports both direct version and workspace version inheritance.
   */
  protected parseVersion(content: string): string | null {
    // Check for workspace version first
    const workspaceVersion = this.extractWorkspaceVersion(content);
    if (workspaceVersion) {
      return workspaceVersion;
    }

    // Check for package version
    return this.extractPackageVersion(content);
  }

  /**
   * Update version in Cargo.toml content
   *
   * Updates workspace.package.version if present, otherwise package.version.
   */
  protected updateVersion(content: string, version: string): string {
    // Check if using workspace versioning
    if (content.includes('[workspace.package]')) {
      // Update workspace version
      const wsRegex = new RegExp('(\\[workspace\\.package\\][^\\[]*version\\s*=\\s*)"[^"]*"', 's');
      return content.replace(wsRegex, `$1"${version}"`);
    }

    // Update package version
    const pkgRegex = new RegExp('(\\[package\\][^\\[]*version\\s*=\\s*)"[^"]*"', 's');
    return content.replace(pkgRegex, `$1"${version}"`);
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
