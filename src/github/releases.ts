/**
 * GitHub Release Utilities
 *
 * Handles finding releases and filtering pull requests by date.
 *
 * @module github/releases
 */

/**
 * GitHub release information
 */
export interface Release {
  /** Tag name (e.g., "v1.2.3") */
  tagName: string;
  /** ISO 8601 publication date */
  publishedAt: string;
  /** Whether this is marked as a prerelease */
  prerelease: boolean;
}

/**
 * Pull request with merge information
 */
export interface PullRequestWithMergeInfo {
  /** PR number */
  number: number;
  /** PR title */
  title: string;
  /** PR author username */
  author: string | null;
  /** ISO 8601 merge date (null if not merged) */
  mergedAt: string | null;
  /** Labels on the PR */
  labels: string[];
}

/** Default pattern for detecting prerelease tags */
const DEFAULT_PRERELEASE_PATTERN = '-dev|-alpha|-beta|-rc';

/**
 * Find the last stable (non-prerelease) release
 *
 * @param releases - List of releases, ordered by date (newest first)
 * @param prereleasePattern - Regex pattern for prerelease tag detection
 * @returns The last stable release, or null if none found
 *
 * @example
 * const stable = findLastStableRelease(releases);
 * // Returns release with tag like "v1.2.0", skipping "v1.3.0-dev.abc"
 */
export function findLastStableRelease(
  releases: Release[],
  prereleasePattern: string = DEFAULT_PRERELEASE_PATTERN
): Release | null {
  const prereleaseRegex = new RegExp(prereleasePattern);

  for (const release of releases) {
    // Check both the prerelease flag and the tag name
    const isPrereleaseByFlag = release.prerelease;
    const isPrereleaseByTag = prereleaseRegex.test(release.tagName);

    if (!isPrereleaseByFlag && !isPrereleaseByTag) {
      return release;
    }
  }

  return null;
}

/**
 * Filter pull requests merged after a given date
 *
 * @param prs - List of pull requests with merge information
 * @param sinceDate - ISO 8601 date string to filter from (exclusive)
 * @returns PRs merged strictly after the given date
 *
 * @example
 * const recentPRs = filterPRsSinceDate(allPRs, '2024-01-15T00:00:00Z');
 */
export function filterPRsSinceDate(
  prs: PullRequestWithMergeInfo[],
  sinceDate: string
): PullRequestWithMergeInfo[] {
  const sinceTimestamp = new Date(sinceDate).getTime();

  return prs.filter((pr) => {
    // Skip PRs without a merge date
    if (!pr.mergedAt) {
      return false;
    }

    const mergedTimestamp = new Date(pr.mergedAt).getTime();

    // Only include PRs merged strictly after the date
    return mergedTimestamp > sinceTimestamp;
  });
}
