/**
 * GitHub Label Utilities
 *
 * Handles extracting and parsing release-related labels from pull requests.
 *
 * @module github/labels
 */

import type { BumpType } from '../core/version.js';

/**
 * Prerelease type for alpha, beta, rc versions
 */
export type PrereleaseType = 'alpha' | 'beta' | 'rc';

/**
 * Configuration for release labels
 */
export interface LabelConfig {
  /** Label indicating a major version bump */
  major: string;
  /** Label indicating a minor version bump */
  minor: string;
  /** Label indicating a patch version bump */
  patch: string;
  /** Label indicating release should be skipped */
  skip: string;
  /** Label indicating alpha prerelease */
  alpha: string;
  /** Label indicating beta prerelease */
  beta: string;
  /** Label indicating release candidate */
  rc: string;
}

/**
 * Simplified pull request with labels
 */
export interface PullRequest {
  number: number;
  labels: string[];
}

/**
 * Result of analyzing labels for bump type
 */
export interface BumpTypeResult {
  /** The bump type to apply, or null if no release labels found */
  bumpType: BumpType | null;
  /** Whether release should be skipped due to skip label */
  skip: boolean;
  /** Prerelease type if alpha/beta/rc label found */
  prerelease: PrereleaseType | null;
}

/**
 * Extract release-related labels from a list of pull requests
 *
 * @param prs - List of pull requests with labels
 * @param config - Label configuration
 * @returns Unique list of release-related labels found
 *
 * @example
 * const labels = extractReleaseLabels(prs, {
 *   major: 'release:major',
 *   minor: 'release:minor',
 *   patch: 'release:patch',
 *   skip: 'release:skip',
 *   alpha: 'release:alpha',
 *   beta: 'release:beta',
 *   rc: 'release:rc'
 * });
 */
export function extractReleaseLabels(prs: PullRequest[], config: LabelConfig): string[] {
  const releaseLabels = new Set<string>();
  const validLabels = new Set([
    config.major,
    config.minor,
    config.patch,
    config.skip,
    config.alpha,
    config.beta,
    config.rc,
  ]);

  for (const pr of prs) {
    for (const label of pr.labels) {
      if (validLabels.has(label)) {
        releaseLabels.add(label);
      }
    }
  }

  // Only include skip label if ALL PRs have it — a single PR without
  // the skip label means there are meaningful changes to release.
  if (releaseLabels.has(config.skip) && prs.length > 0) {
    const allPRsHaveSkip = prs.every((pr) => pr.labels.includes(config.skip));
    if (!allPRsHaveSkip) {
      releaseLabels.delete(config.skip);
    }
  }

  return Array.from(releaseLabels);
}

/**
 * Determine bump type and prerelease from a list of labels
 *
 * Priority for bump: skip > major > minor > patch
 * Priority for prerelease: rc > beta > alpha
 *
 * @param labels - List of labels (from extractReleaseLabels)
 * @param config - Label configuration
 * @returns Bump type result with skip flag and prerelease type
 *
 * @example
 * const result = getBumpTypeFromLabels(['release:minor', 'release:rc'], config);
 * // { bumpType: 'minor', skip: false, prerelease: 'rc' }
 */
export function getBumpTypeFromLabels(labels: string[], config: LabelConfig): BumpTypeResult {
  // Check for skip label first
  if (labels.includes(config.skip)) {
    return { bumpType: null, skip: true, prerelease: null };
  }

  // Determine bump type in priority order
  let bumpType: BumpType | null = null;
  if (labels.includes(config.major)) {
    bumpType = 'major';
  } else if (labels.includes(config.minor)) {
    bumpType = 'minor';
  } else if (labels.includes(config.patch)) {
    bumpType = 'patch';
  }

  // Determine prerelease type in priority order (rc > beta > alpha)
  let prerelease: PrereleaseType | null = null;
  if (labels.includes(config.rc)) {
    prerelease = 'rc';
  } else if (labels.includes(config.beta)) {
    prerelease = 'beta';
  } else if (labels.includes(config.alpha)) {
    prerelease = 'alpha';
  }

  return { bumpType, skip: false, prerelease };
}
