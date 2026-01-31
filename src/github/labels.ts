/**
 * GitHub Label Utilities
 *
 * Handles extracting and parsing release-related labels from pull requests.
 *
 * @module github/labels
 */

import type { BumpType } from '../core/version.js';

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
 *   skip: 'release:skip'
 * });
 */
export function extractReleaseLabels(prs: PullRequest[], config: LabelConfig): string[] {
  const releaseLabels = new Set<string>();
  const validLabels = new Set([config.major, config.minor, config.patch, config.skip]);

  for (const pr of prs) {
    for (const label of pr.labels) {
      if (validLabels.has(label)) {
        releaseLabels.add(label);
      }
    }
  }

  return Array.from(releaseLabels);
}

/**
 * Determine bump type from a list of labels
 *
 * Priority: skip > major > minor > patch
 *
 * @param labels - List of labels (from extractReleaseLabels)
 * @param config - Label configuration
 * @returns Bump type result with skip flag
 *
 * @example
 * const result = getBumpTypeFromLabels(['release:minor', 'release:patch'], config);
 * // { bumpType: 'minor', skip: false }
 */
export function getBumpTypeFromLabels(labels: string[], config: LabelConfig): BumpTypeResult {
  // Check for skip label first
  if (labels.includes(config.skip)) {
    return { bumpType: null, skip: true };
  }

  // Check for bump types in priority order
  if (labels.includes(config.major)) {
    return { bumpType: 'major', skip: false };
  }

  if (labels.includes(config.minor)) {
    return { bumpType: 'minor', skip: false };
  }

  if (labels.includes(config.patch)) {
    return { bumpType: 'patch', skip: false };
  }

  // No release labels found
  return { bumpType: null, skip: false };
}
