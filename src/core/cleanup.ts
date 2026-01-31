/**
 * Cleanup Operations
 *
 * Handles cleanup of old releases, tags, and published packages.
 * Supports per-release-type configuration (dev, alpha, beta, rc, stable).
 *
 * @module core/cleanup
 */

import * as exec from '@actions/exec';
import type {
  ResolvedCleanupConfig,
  ResolvedCleanupTypeConfig,
  ResolvedPackageConfig,
} from '../config/loader.js';
import type {
  EcosystemContext,
  EcosystemRegistry,
  RegistryConfig,
} from '../ecosystems/base.js';
import type { GitHubClient, ReleaseInfo } from '../github/client.js';

/**
 * Release type identifiers
 */
export type ReleaseType = 'dev' | 'alpha' | 'beta' | 'rc' | 'stable';

/**
 * Options for cleanup operations
 */
export interface CleanupOptions {
  /** Working directory for git commands */
  cwd: string;
  /** Whether to skip actual execution (dry run) */
  dryRun: boolean;
  /** Logger function */
  log: (message: string) => void;
  /** Warning logger */
  warn: (message: string) => void;
  /** Packages to clean up published versions from */
  packages?: ResolvedPackageConfig[];
  /** Ecosystem registry for unpublishing */
  ecosystemRegistry?: EcosystemRegistry;
  /** Registry credentials for unpublishing */
  registryConfig?: RegistryConfig;
}

/**
 * Result of cleanup operations
 */
export interface CleanupResult {
  /** Number of tags deleted */
  tagsDeleted: number;
  /** Number of GitHub releases deleted */
  releasesDeleted: number;
  /** Number of published packages unpublished */
  packagesUnpublished: number;
  /** Warnings encountered */
  warnings: string[];
}

/**
 * Determine the release type from a version string
 *
 * @param version - Version string (e.g., "1.2.3", "1.2.3-dev.abc123", "1.2.3-alpha.1")
 * @returns The release type
 *
 * @example
 * getReleaseType('1.2.3') // 'stable'
 * getReleaseType('1.2.3-dev.abc123') // 'dev'
 * getReleaseType('1.2.3-alpha.1') // 'alpha'
 * getReleaseType('1.2.3-beta.2') // 'beta'
 * getReleaseType('1.2.3-rc.1') // 'rc'
 */
export function getReleaseType(version: string): ReleaseType {
  // Check for prerelease identifiers
  if (version.includes('-dev')) {
    return 'dev';
  }
  if (version.includes('-alpha')) {
    return 'alpha';
  }
  if (version.includes('-beta')) {
    return 'beta';
  }
  if (version.includes('-rc')) {
    return 'rc';
  }
  return 'stable';
}

/**
 * Get the cleanup config for a specific release type
 */
export function getCleanupConfigForType(
  config: ResolvedCleanupConfig,
  releaseType: ReleaseType
): ResolvedCleanupTypeConfig {
  return config[releaseType];
}

/**
 * Filter releases by type and return those eligible for cleanup (oldest first)
 *
 * @param releases - List of releases from GitHub
 * @param releaseType - Type of releases to filter for
 * @param tagPrefix - Tag prefix (e.g., "v")
 * @param keep - Number of releases to keep
 * @returns Releases eligible for cleanup (excluding the `keep` most recent)
 */
export function getReleasesToCleanup(
  releases: ReleaseInfo[],
  releaseType: ReleaseType,
  tagPrefix: string,
  keep: number
): ReleaseInfo[] {
  // Filter to only releases of the specified type
  const matchingReleases = releases.filter((r) => {
    const version = r.tagName.startsWith(tagPrefix)
      ? r.tagName.slice(tagPrefix.length)
      : r.tagName;
    return getReleaseType(version) === releaseType;
  });

  // Sort by published date descending (most recent first)
  const sorted = [...matchingReleases].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // If keep is 0 (keep all) or we don't have enough to cleanup, return empty
  if (keep === 0 || sorted.length <= keep) {
    return [];
  }

  // Return everything after the `keep` most recent
  return sorted.slice(keep);
}

/**
 * Get git tags matching a release type
 *
 * @param releaseType - Type of releases to filter for
 * @param tagPrefix - Tag prefix (e.g., "v")
 * @param options - Cleanup options
 * @returns List of tags matching the release type
 */
export async function getTagsForType(
  releaseType: ReleaseType,
  tagPrefix: string,
  options: Pick<CleanupOptions, 'cwd'>
): Promise<string[]> {
  let output = '';

  await exec.exec('git', ['tag', '-l'], {
    cwd: options.cwd,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
  });

  const allTags = output.trim().split('\n').filter(Boolean);

  // Filter to only tags of the specified type
  return allTags.filter((tag) => {
    const version = tag.startsWith(tagPrefix) ? tag.slice(tagPrefix.length) : tag;
    return getReleaseType(version) === releaseType;
  });
}

/**
 * Get tags eligible for cleanup (oldest first)
 *
 * @param tags - List of tags
 * @param keep - Number to keep
 * @returns Tags eligible for cleanup
 */
export function getTagsToCleanup(tags: string[], keep: number): string[] {
  if (keep === 0 || tags.length <= keep) {
    return [];
  }

  // Sort by semver-ish order (this is a simplification - assumes tags sort lexicographically)
  // For dev tags with timestamps, this should work reasonably well
  const sorted = [...tags].sort().reverse();

  return sorted.slice(keep);
}

/**
 * Delete a git tag locally and remotely
 *
 * @param tag - Tag name to delete
 * @param options - Cleanup options
 */
export async function deleteTag(tag: string, options: CleanupOptions): Promise<void> {
  if (options.dryRun) {
    options.log(`[dry-run] Would delete tag: ${tag}`);
    return;
  }

  // Delete remote tag first
  try {
    await exec.exec('git', ['push', 'origin', '--delete', tag], { cwd: options.cwd });
  } catch {
    options.warn(`Failed to delete remote tag ${tag} (may not exist)`);
  }

  // Delete local tag
  try {
    await exec.exec('git', ['tag', '-d', tag], { cwd: options.cwd });
  } catch {
    // Local tag may not exist
  }

  options.log(`Deleted tag: ${tag}`);
}

/**
 * Cleanup old releases for a specific release type
 *
 * @param gh - GitHub client
 * @param releases - All releases
 * @param releaseType - Type of releases to cleanup
 * @param config - Cleanup config for this type
 * @param tagPrefix - Tag prefix
 * @param options - Cleanup options
 * @returns Cleanup results
 */
export async function cleanupReleaseType(
  gh: GitHubClient,
  releases: ReleaseInfo[],
  releaseType: ReleaseType,
  config: ResolvedCleanupTypeConfig,
  tagPrefix: string,
  options: CleanupOptions
): Promise<CleanupResult> {
  const result: CleanupResult = {
    tagsDeleted: 0,
    releasesDeleted: 0,
    packagesUnpublished: 0,
    warnings: [],
  };

  // Check if any cleanup is enabled for this type
  if (!config.tags && !config.releases && !config.published) {
    return result;
  }

  options.log(`Cleaning up ${releaseType} releases (keep: ${config.keep})...`);

  // Cleanup GitHub releases
  if (config.releases) {
    const releasesToDelete = getReleasesToCleanup(releases, releaseType, tagPrefix, config.keep);

    for (const release of releasesToDelete) {
      if (options.dryRun) {
        options.log(`[dry-run] Would delete release: ${release.tagName}`);
      } else {
        try {
          await gh.deleteRelease(release.id);
          options.log(`Deleted release: ${release.tagName}`);
          result.releasesDeleted++;
        } catch (error) {
          const msg = `Failed to delete release ${release.tagName}: ${error}`;
          result.warnings.push(msg);
          options.warn(msg);
        }
      }
    }
  }

  // Cleanup git tags
  if (config.tags) {
    const allTags = await getTagsForType(releaseType, tagPrefix, options);
    const tagsToDelete = getTagsToCleanup(allTags, config.keep);

    for (const tag of tagsToDelete) {
      try {
        await deleteTag(tag, options);
        result.tagsDeleted++;
      } catch (error) {
        const msg = `Failed to delete tag ${tag}: ${error}`;
        result.warnings.push(msg);
        options.warn(msg);
      }
    }
  }

  // Cleanup published packages
  if (config.published && options.packages && options.ecosystemRegistry) {
    const releasesToDelete = getReleasesToCleanup(releases, releaseType, tagPrefix, config.keep);

    for (const release of releasesToDelete) {
      const version = release.tagName.startsWith(tagPrefix)
        ? release.tagName.slice(tagPrefix.length)
        : release.tagName;

      // Unpublish each package
      for (const pkg of options.packages) {
        const ecosystem = options.ecosystemRegistry.get(pkg.ecosystem);

        if (!ecosystem) {
          continue;
        }

        // Check if ecosystem supports unpublish
        if (!ecosystem.supportsUnpublish || !ecosystem.unpublish) {
          const unsupportedEcosystems = ['cargo', 'go', 'composer', 'custom'];
          if (unsupportedEcosystems.includes(pkg.ecosystem)) {
            // Only warn once per release type, not per version
            if (releasesToDelete.indexOf(release) === 0) {
              const msg = getUnsupportedUnpublishMessage(pkg.ecosystem);
              result.warnings.push(msg);
              options.warn(msg);
            }
          }
          continue;
        }

        const ctx: EcosystemContext = {
          path: pkg.path,
          versionFile: pkg.versionFile,
          dryRun: options.dryRun,
          log: options.log,
          registry: options.registryConfig,
        };

        try {
          const success = await ecosystem.unpublish(ctx, version);
          if (success) {
            result.packagesUnpublished++;
            if (!options.dryRun) {
              options.log(`Unpublished ${pkg.name}@${version}`);
            }
          }
        } catch (error) {
          const msg = `Failed to unpublish ${pkg.name}@${version}: ${error}`;
          result.warnings.push(msg);
          options.warn(msg);
        }
      }
    }
  }

  return result;
}

/**
 * Get warning message for ecosystems that don't support unpublish
 */
function getUnsupportedUnpublishMessage(ecosystem: string): string {
  switch (ecosystem) {
    case 'cargo':
      return 'Cargo (crates.io) does not support unpublishing. Use `cargo yank` to mark versions as unusable.';
    case 'go':
      return 'Go modules use git tags for versioning. Tag cleanup is handled separately.';
    case 'composer':
      return 'Packagist does not support programmatic package deletion.';
    case 'custom':
      return 'Custom ecosystems do not have a standard unpublish mechanism.';
    default:
      return `Ecosystem ${ecosystem} does not support unpublishing.`;
  }
}

/**
 * Run cleanup for all release types based on configuration
 *
 * @param gh - GitHub client
 * @param config - Cleanup configuration
 * @param tagPrefix - Tag prefix (e.g., "v")
 * @param options - Cleanup options
 * @returns Combined cleanup results
 */
export async function runCleanup(
  gh: GitHubClient,
  config: ResolvedCleanupConfig,
  tagPrefix: string,
  options: CleanupOptions
): Promise<CleanupResult> {
  const combinedResult: CleanupResult = {
    tagsDeleted: 0,
    releasesDeleted: 0,
    packagesUnpublished: 0,
    warnings: [],
  };

  // Check if cleanup is globally enabled
  if (!config.enabled) {
    options.log('Cleanup is disabled');
    return combinedResult;
  }

  // Fetch all releases once
  const releases = await gh.listReleases(500); // Fetch more for cleanup purposes

  // Process each release type
  const releaseTypes: ReleaseType[] = ['dev', 'alpha', 'beta', 'rc', 'stable'];

  for (const releaseType of releaseTypes) {
    const typeConfig = getCleanupConfigForType(config, releaseType);
    const result = await cleanupReleaseType(
      gh,
      releases,
      releaseType,
      typeConfig,
      tagPrefix,
      options
    );

    // Combine results
    combinedResult.tagsDeleted += result.tagsDeleted;
    combinedResult.releasesDeleted += result.releasesDeleted;
    combinedResult.packagesUnpublished += result.packagesUnpublished;
    combinedResult.warnings.push(...result.warnings);
  }

  // Log summary
  const parts = [];
  if (combinedResult.tagsDeleted > 0) {
    parts.push(`${combinedResult.tagsDeleted} tags`);
  }
  if (combinedResult.releasesDeleted > 0) {
    parts.push(`${combinedResult.releasesDeleted} releases`);
  }
  if (combinedResult.packagesUnpublished > 0) {
    parts.push(`${combinedResult.packagesUnpublished} packages`);
  }

  if (parts.length > 0) {
    options.log(`Cleanup complete: ${parts.join(', ')} deleted`);
  } else {
    options.log('Cleanup complete: nothing to clean up');
  }

  return combinedResult;
}
