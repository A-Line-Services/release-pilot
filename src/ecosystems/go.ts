/**
 * Go Ecosystem Implementation
 *
 * Handles version management for Go modules.
 * Go uses git tags for versioning - no version file to update.
 *
 * @module ecosystems/go
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Ecosystem, EcosystemContext } from './base.js';

/**
 * Go ecosystem implementation
 *
 * Go modules use git tags for versioning (e.g., v1.2.3).
 * There's no version in go.mod to update - it only contains the module path.
 *
 * This ecosystem:
 * - Detects go.mod files
 * - Returns the version from git tags (not from a file)
 * - Does not write version to any file
 * - Does not publish (Go modules are fetched directly from git)
 *
 * @example
 * const go = new GoEcosystem();
 * await go.detect('./my-go-project'); // true if go.mod exists
 */
export class GoEcosystem implements Ecosystem {
  readonly name = 'go';

  /**
   * Detect if this is a Go module
   */
  async detect(path: string): Promise<boolean> {
    return existsSync(join(path, 'go.mod'));
  }

  /**
   * Read version - Go doesn't store version in files
   *
   * Returns '0.0.0' as a placeholder. The actual version comes from git tags.
   */
  async readVersion(ctx: EcosystemContext): Promise<string> {
    ctx.log('Go modules use git tags for versioning');
    return '0.0.0';
  }

  /**
   * Write version - No-op for Go
   *
   * Go modules don't have a version file to update.
   * The version is determined by git tags.
   */
  async writeVersion(ctx: EcosystemContext, version: string): Promise<void> {
    ctx.log(`Go version ${version} will be set via git tag`);
    // No file to update - version comes from git tag
  }

  /**
   * Get version files - returns go.mod for tracking
   *
   * While we don't modify go.mod for versioning, we include it
   * so the module is recognized.
   */
  async getVersionFiles(_ctx: EcosystemContext): Promise<string[]> {
    return ['go.mod'];
  }

  // No publish method - Go modules are fetched directly from git
}
