/**
 * Cargo (Rust) Ecosystem Implementation
 *
 * Handles version management for Rust crates using Cargo.toml.
 * Supports both package-level and workspace-level versioning.
 *
 * @module ecosystems/cargo
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
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
   * If registry.cargoToken is provided, sets the CARGO_REGISTRY_TOKEN
   * environment variable for the publish command.
   * Otherwise, assumes credentials are already configured.
   */
  async publish(ctx: EcosystemContext): Promise<void> {
    if (ctx.dryRun) {
      ctx.log('[dry-run] Would run: cargo publish');
      return;
    }

    const { exec } = await import('@actions/exec');

    const args = ['publish', '--allow-dirty'];

    // Pass token via environment variable (--token is deprecated)
    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    if (ctx.registry?.cargoToken) {
      env.CARGO_REGISTRY_TOKEN = ctx.registry.cargoToken;
      ctx.log('Using provided cargo token');
    }

    await exec('cargo', args, {
      cwd: ctx.path,
      env,
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
   * Read the current version, resolving workspace inheritance if needed.
   *
   * When the member crate uses `version.workspace = true`, walks up the
   * directory tree to find the workspace root Cargo.toml and reads the
   * version from `[workspace.package]`.
   */
  async readVersion(ctx: EcosystemContext): Promise<string> {
    const manifestPath = this.getManifestPath(ctx);

    if (!existsSync(manifestPath)) {
      throw new Error(`Cargo.toml not found at ${manifestPath}`);
    }

    const content = readFileSync(manifestPath, 'utf-8');

    if (this.usesWorkspaceInheritance(content)) {
      const rootPath = this.findWorkspaceRoot(ctx.path);
      if (!rootPath) {
        throw new Error(
          `Crate at ${ctx.path} uses version.workspace = true but no workspace root Cargo.toml found`
        );
      }
      const rootContent = readFileSync(rootPath, 'utf-8');
      const version = this.extractWorkspaceVersion(rootContent);
      if (!version) {
        throw new Error(`No version found in workspace root ${rootPath}`);
      }
      return version;
    }

    const version = this.parseVersion(content, manifestPath);
    if (!version) {
      throw new Error(`No version found in ${manifestPath}`);
    }
    return version;
  }

  /**
   * Write a new version, targeting the workspace root when the member
   * uses `version.workspace = true`.
   */
  async writeVersion(ctx: EcosystemContext, version: string): Promise<void> {
    if (ctx.dryRun) {
      ctx.log(`[dry-run] Would write version ${version} to Cargo.toml`);
      return;
    }

    const manifestPath = this.getManifestPath(ctx);
    const content = readFileSync(manifestPath, 'utf-8');

    if (this.usesWorkspaceInheritance(content)) {
      const rootPath = this.findWorkspaceRoot(ctx.path);
      if (!rootPath) {
        throw new Error(
          `Crate at ${ctx.path} uses version.workspace = true but no workspace root Cargo.toml found`
        );
      }
      const rootContent = readFileSync(rootPath, 'utf-8');
      const updatedContent = this.updateVersion(rootContent, version);
      writeFileSync(rootPath, updatedContent);
      ctx.log(`Updated version to ${version} in ${rootPath}`);
      return;
    }

    const updatedContent = this.updateVersion(content, version);
    writeFileSync(manifestPath, updatedContent);
    ctx.log(`Updated version to ${version} in ${manifestPath}`);
  }

  /**
   * Get files that should be committed after version bump.
   *
   * When the crate uses workspace inheritance, includes the workspace
   * root Cargo.toml as a relative path from the member directory.
   */
  async getVersionFiles(ctx: EcosystemContext): Promise<string[]> {
    const files = [this.config.manifestFile];

    const manifestPath = this.getManifestPath(ctx);
    if (existsSync(manifestPath)) {
      const content = readFileSync(manifestPath, 'utf-8');
      if (this.usesWorkspaceInheritance(content)) {
        const rootPath = this.findWorkspaceRoot(ctx.path);
        if (rootPath) {
          const relPath = relative(ctx.path, rootPath);
          files.push(relPath);
        }
      }
    }

    // Check for lockfiles
    for (const lockFile of this.config.lockFiles ?? []) {
      if (existsSync(join(ctx.path, lockFile))) {
        files.push(lockFile);
      }
    }

    return files;
  }

  /**
   * Parse version from Cargo.toml content
   *
   * Supports both direct version and workspace version inheritance.
   */
  protected parseVersion(content: string, _filePath?: string): string | null {
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
   * When updating a workspace root, also updates version constraints in
   * [workspace.dependencies] for entries that have a path (local members).
   */
  protected updateVersion(content: string, version: string): string {
    // Check if using workspace versioning
    if (content.includes('[workspace.package]')) {
      // Update workspace version
      const wsRegex = /(\[workspace\.package\][^[]*\n[ \t]*version\s*=\s*)"[^"]*"/s;
      let updated = content.replace(wsRegex, `$1"${version}"`);

      // Also update [workspace.dependencies] entries that reference local path deps
      updated = this.updateWorkspaceDependencyVersions(updated, version);

      return updated;
    }

    // Update package version
    const pkgRegex = /(\[package\][^[]*\n[ \t]*version\s*=\s*)"[^"]*"/s;
    return content.replace(pkgRegex, `$1"${version}"`);
  }

  /**
   * Update version constraints in [workspace.dependencies] for entries
   * that also have a `path` field, indicating they are local workspace members
   * whose version should stay in sync with the workspace version.
   *
   * Only matches inline table entries (single-line) that contain both
   * `version = "..."` and `path = "..."`.
   */
  private updateWorkspaceDependencyVersions(content: string, version: string): string {
    const lines = content.split('\n');
    let inWorkspaceDeps = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string;
      const trimmed = line.trim();

      // Track section headers
      if (trimmed.startsWith('[')) {
        inWorkspaceDeps = trimmed === '[workspace.dependencies]';
        continue;
      }

      // Within [workspace.dependencies], update version in entries that have a path
      if (inWorkspaceDeps && /path\s*=\s*"/.test(line) && /version\s*=\s*"/.test(line)) {
        lines[i] = line.replace(/(version\s*=\s*)"[^"]*"/, `$1"${version}"`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Check if a Cargo.toml uses `version.workspace = true` and the version
   * is inherited from a separate workspace root (not defined locally).
   *
   * Returns false when `[workspace.package]` exists in the same file,
   * because the file is itself the workspace root.
   */
  private usesWorkspaceInheritance(content: string): boolean {
    const inherits = /\[package\][^[]*version\.workspace\s*=\s*true/s.test(content);
    if (!inherits) return false;
    // If this file also defines [workspace.package], it is the root itself
    return !content.includes('[workspace.package]');
  }

  /**
   * Walk up the directory tree to find the workspace root Cargo.toml
   * containing a `[workspace.package]` section with a version.
   *
   * @returns Absolute path to the workspace root Cargo.toml, or null if not found
   */
  private findWorkspaceRoot(memberPath: string): string | null {
    let dir = dirname(memberPath);
    // Walk up at most 10 levels to avoid infinite loops
    for (let i = 0; i < 10; i++) {
      const candidate = join(dir, 'Cargo.toml');
      if (existsSync(candidate)) {
        const content = readFileSync(candidate, 'utf-8');
        if (content.includes('[workspace.package]')) {
          return candidate;
        }
      }
      const parent = dirname(dir);
      if (parent === dir) break; // Reached filesystem root
      dir = parent;
    }
    return null;
  }

  /**
   * Extract version from [workspace.package] section
   */
  private extractWorkspaceVersion(content: string): string | null {
    const regex = /\[workspace\.package\][^[]*\n[ \t]*version\s*=\s*"([^"]+)"/s;
    const match = content.match(regex);
    return match?.[1] ?? null;
  }

  /**
   * Extract version from [package] section
   */
  private extractPackageVersion(content: string): string | null {
    // First check if version uses workspace inheritance
    if (this.usesWorkspaceInheritance(content)) {
      // Fall back to workspace version
      return this.extractWorkspaceVersion(content);
    }

    const regex = /\[package\][^[]*\n[ \t]*version\s*=\s*"([^"]+)"/s;
    const match = content.match(regex);
    return match?.[1] ?? null;
  }
}
