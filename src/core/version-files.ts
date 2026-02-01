/**
 * Version File Updates
 *
 * Handles updating version references in files like README, docs, etc.
 *
 * @module core/version-files
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ResolvedVersionFileUpdate } from '../config/loader.js';
import type { BaseOperationOptions } from './types.js';

/**
 * Parsed version for template replacement
 */
export interface VersionParts {
  version: string;
  major: string;
  minor: string;
  patch: string;
}

/**
 * Result of a version file update
 */
export interface VersionFileUpdateResult {
  file: string;
  updated: boolean;
  matches: number;
  error?: string;
}

/**
 * Options for updating version files
 */
export type UpdateVersionFilesOptions = BaseOperationOptions;

/**
 * Parse a version string into its parts
 */
export function parseVersionParts(version: string): VersionParts {
  // Remove v prefix if present
  const clean = version.replace(/^v/, '');

  // Extract major.minor.patch (ignore prerelease)
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
 * Apply version placeholders to a replacement template
 *
 * @param template - Template string with {version}, {major}, {minor}, {patch} placeholders
 * @param parts - Version parts to substitute
 * @returns Processed string
 *
 * @example
 * applyVersionTemplate('uses: org/action@v{version}', { version: '1.2.3', ... })
 * // 'uses: org/action@v1.2.3'
 */
export function applyVersionTemplate(template: string, parts: VersionParts): string {
  return template
    .replace(/\{version\}/g, parts.version)
    .replace(/\{major\}/g, parts.major)
    .replace(/\{minor\}/g, parts.minor)
    .replace(/\{patch\}/g, parts.patch);
}

/**
 * Update version references in a single file
 *
 * @param config - File update configuration
 * @param version - New version to apply
 * @param options - Update options
 * @returns Update result
 */
export function updateVersionFile(
  config: ResolvedVersionFileUpdate,
  version: string,
  options: UpdateVersionFilesOptions
): VersionFileUpdateResult {
  const filePath = join(options.cwd, config.file);

  // Check file exists
  if (!existsSync(filePath)) {
    return {
      file: config.file,
      updated: false,
      matches: 0,
      error: `File not found: ${config.file}`,
    };
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const regex = new RegExp(config.pattern, 'g');

    // Count matches
    const matches = (content.match(regex) || []).length;
    if (matches === 0) {
      return {
        file: config.file,
        updated: false,
        matches: 0,
        error: `Pattern not found: ${config.pattern}`,
      };
    }

    // Apply version to replacement template
    const parts = parseVersionParts(version);
    const replacement = applyVersionTemplate(config.replace, parts);

    // Replace all matches
    const newContent = content.replace(regex, replacement);

    if (newContent === content) {
      return {
        file: config.file,
        updated: false,
        matches,
      };
    }

    // Write updated content
    if (options.dryRun) {
      options.log(`[dry-run] Would update ${config.file} (${matches} matches)`);
    } else {
      writeFileSync(filePath, newContent);
      options.log(`Updated ${config.file} (${matches} matches)`);
    }

    return {
      file: config.file,
      updated: true,
      matches,
    };
  } catch (error) {
    return {
      file: config.file,
      updated: false,
      matches: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update version references in multiple files
 *
 * @param configs - List of file update configurations
 * @param version - New version to apply
 * @param options - Update options
 * @returns List of update results
 */
export function updateVersionFiles(
  configs: ResolvedVersionFileUpdate[],
  version: string,
  options: UpdateVersionFilesOptions
): VersionFileUpdateResult[] {
  return configs.map((config) => updateVersionFile(config, version, options));
}

/**
 * Get list of files that were updated (for git staging)
 */
export function getUpdatedFiles(results: VersionFileUpdateResult[]): string[] {
  return results.filter((r) => r.updated).map((r) => r.file);
}
