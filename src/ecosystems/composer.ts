/**
 * Composer (PHP) Ecosystem Implementation
 *
 * Handles version management for PHP packages using composer.json.
 *
 * @module ecosystems/composer
 */

import { BaseFileEcosystem } from './base.js';

/**
 * Composer ecosystem implementation for PHP packages
 *
 * Supports:
 * - Reading/writing version in composer.json
 * - Note: Most PHP packages use git tags for versioning via Packagist
 *
 * @example
 * const composer = new ComposerEcosystem();
 * const version = await composer.readVersion(ctx);
 * await composer.writeVersion(ctx, '1.2.0');
 */
export class ComposerEcosystem extends BaseFileEcosystem {
  readonly name = 'composer';

  constructor() {
    super({
      manifestFile: 'composer.json',
      lockFiles: ['composer.lock'],
    });
  }

  /**
   * Parse version from composer.json content
   */
  protected parseVersion(content: string): string | null {
    const pkg = JSON.parse(content);
    return pkg.version ?? null;
  }

  /**
   * Update version in composer.json content
   */
  protected updateVersion(content: string, version: string): string {
    const pkg = JSON.parse(content);
    const indent = this.detectIndent(content);
    pkg.version = version;
    return `${JSON.stringify(pkg, null, indent)}\n`;
  }

  /**
   * Detect indentation used in JSON file
   */
  private detectIndent(content: string): number {
    const match = content.match(/^(\s+)"/m);
    if (match?.[1]) {
      return match[1].length;
    }
    return 4; // Composer default is 4 spaces
  }

  // No publish method - PHP packages typically publish via Packagist
  // which pulls from git tags automatically
}
