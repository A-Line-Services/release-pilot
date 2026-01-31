/**
 * Custom Ecosystem Implementation
 *
 * Allows users to define their own version file and publish commands.
 *
 * @module ecosystems/custom
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Ecosystem, EcosystemContext } from './base.js';

/**
 * Extended context for Custom ecosystem
 */
export interface CustomEcosystemContext extends EcosystemContext {
  /** Custom publish command */
  publishCommand?: string;
  /** Arguments for publish command */
  publishArgs?: string[];
}

/**
 * Custom ecosystem implementation
 *
 * Allows users to:
 * - Specify a custom version file with regex pattern
 * - Define custom publish commands
 *
 * @example
 * // In release-pilot.yml:
 * packages:
 *   - name: my-pkg
 *     ecosystem: custom
 *     versionFile: VERSION.txt
 *     publishCommand: ./scripts/publish.sh
 *     publishArgs: ["--production"]
 */
export class CustomEcosystem implements Ecosystem {
  readonly name = 'custom';

  /**
   * Detect - always returns true for custom
   *
   * Custom ecosystem relies on explicit configuration.
   */
  async detect(_path: string): Promise<boolean> {
    return true;
  }

  /**
   * Read version from custom version file
   *
   * Expects a simple file containing just the version string,
   * or uses versionFile from context.
   */
  async readVersion(ctx: EcosystemContext): Promise<string> {
    const versionFile = ctx.versionFile ?? 'VERSION';
    const filePath = join(ctx.path, versionFile);

    if (!existsSync(filePath)) {
      ctx.log(`Version file not found: ${versionFile}, using 0.0.0`);
      return '0.0.0';
    }

    const content = readFileSync(filePath, 'utf-8').trim();

    // Try to extract version from content
    // Support formats like: 1.2.3, v1.2.3, version = "1.2.3", VERSION=1.2.3
    const match = content.match(/v?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/);
    if (match?.[1]) {
      return match[1];
    }

    // If content looks like just a version, return it
    if (/^\d+\.\d+\.\d+/.test(content)) {
      return content;
    }

    ctx.log(`Could not parse version from ${versionFile}`);
    return '0.0.0';
  }

  /**
   * Write version to custom version file
   */
  async writeVersion(ctx: EcosystemContext, version: string): Promise<void> {
    const versionFile = ctx.versionFile ?? 'VERSION';
    const filePath = join(ctx.path, versionFile);

    if (ctx.dryRun) {
      ctx.log(`[dry-run] Would write version ${version} to ${versionFile}`);
      return;
    }

    if (existsSync(filePath)) {
      // Update existing file
      const content = readFileSync(filePath, 'utf-8');
      const newContent = content.replace(/v?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/, version);
      writeFileSync(filePath, newContent);
    } else {
      // Create new file with just the version
      writeFileSync(filePath, `${version}\n`);
    }

    ctx.log(`Updated version to ${version} in ${versionFile}`);
  }

  /**
   * Get version files
   */
  async getVersionFiles(ctx: EcosystemContext): Promise<string[]> {
    const versionFile = ctx.versionFile ?? 'VERSION';
    return [versionFile];
  }

  /**
   * Run custom publish command
   */
  async publish(ctx: EcosystemContext): Promise<void> {
    const customCtx = ctx as CustomEcosystemContext;

    if (!customCtx.publishCommand) {
      ctx.log('No publish command configured for custom ecosystem');
      return;
    }

    if (ctx.dryRun) {
      const args = customCtx.publishArgs?.join(' ') ?? '';
      ctx.log(`[dry-run] Would run: ${customCtx.publishCommand} ${args}`);
      return;
    }

    const { exec } = await import('@actions/exec');

    await exec(customCtx.publishCommand, customCtx.publishArgs ?? [], {
      cwd: ctx.path,
    });

    ctx.log(`Published using: ${customCtx.publishCommand}`);
  }
}
