/**
 * Test Data Factories
 *
 * Provides helpers for creating test data objects like PRs, releases, and configs.
 *
 * @module tests/helpers/factories
 */

import type { ResolvedLabelsConfig } from '../../src/config/loader.js';
import type { ChangelogPR } from '../../src/core/changelog.js';
import type { PullRequestInfo, ReleaseInfo } from '../../src/github/client.js';

// =============================================================================
// Pull Request Factories
// =============================================================================

/**
 * Create a ChangelogPR for testing
 */
export function createChangelogPR(overrides: Partial<ChangelogPR> = {}): ChangelogPR {
  return {
    number: 1,
    title: 'Test PR',
    labels: [],
    ...overrides,
  };
}

/**
 * Create a feature PR
 */
export function createFeaturePR(number: number, title: string, author?: string): ChangelogPR {
  return createChangelogPR({
    number,
    title,
    author,
    labels: ['feature'],
  });
}

/**
 * Create a bugfix PR
 */
export function createBugfixPR(number: number, title: string, author?: string): ChangelogPR {
  return createChangelogPR({
    number,
    title,
    author,
    labels: ['bug'],
  });
}

/**
 * Create a PullRequestInfo for testing (used in labels tests)
 */
export function createPullRequestInfo(overrides: Partial<PullRequestInfo> = {}): PullRequestInfo {
  return {
    number: 1,
    title: 'Test PR',
    author: null,
    mergedAt: '2024-01-01T00:00:00Z',
    labels: [],
    ...overrides,
  };
}

// =============================================================================
// Release Factories
// =============================================================================

/**
 * Create a ReleaseInfo for testing
 */
export function createRelease(overrides: Partial<ReleaseInfo> = {}): ReleaseInfo {
  return {
    id: 1,
    tagName: 'v1.0.0',
    publishedAt: '2024-01-01T00:00:00Z',
    prerelease: false,
    ...overrides,
  };
}

/**
 * Create multiple sequential releases
 *
 * @param count - Number of releases to create
 * @param options - Base options for all releases
 * @returns Array of ReleaseInfo
 *
 * @example
 * createReleases(3) // v1.0.0, v1.0.1, v1.0.2
 * createReleases(3, { prerelease: true }) // all prereleases
 */
export function createReleases(
  count: number,
  options: Partial<Omit<ReleaseInfo, 'id' | 'tagName' | 'publishedAt'>> = {}
): ReleaseInfo[] {
  return Array.from({ length: count }, (_, i) =>
    createRelease({
      id: i + 1,
      tagName: `v1.0.${i}`,
      publishedAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      ...options,
    })
  );
}

/**
 * Create a dev/prerelease version
 */
export function createDevRelease(id: number, version: string, publishedAt: string): ReleaseInfo {
  return createRelease({
    id,
    tagName: `v${version}`,
    publishedAt,
    prerelease: true,
  });
}

// =============================================================================
// Label Config Factories
// =============================================================================

/**
 * Default label configuration
 */
export const DEFAULT_LABEL_CONFIG: ResolvedLabelsConfig = {
  major: 'release:major',
  minor: 'release:minor',
  patch: 'release:patch',
  skip: 'release:skip',
  alpha: 'release:alpha',
  beta: 'release:beta',
  rc: 'release:rc',
};

/**
 * Create a label configuration for testing
 */
export function createLabelConfig(
  overrides: Partial<ResolvedLabelsConfig> = {}
): ResolvedLabelsConfig {
  return { ...DEFAULT_LABEL_CONFIG, ...overrides };
}

// =============================================================================
// Changelog Options Factory
// =============================================================================

/**
 * Default changelog options for testing
 */
export function createChangelogOptions(cwd: string, overrides: Record<string, unknown> = {}) {
  return {
    cwd,
    dryRun: false,
    log: () => {},
    repoOwner: 'test-owner',
    repoName: 'test-repo',
    ...overrides,
  };
}

/**
 * Create changelog options with log capture
 */
export function createChangelogOptionsWithLogs(cwd: string) {
  const logs: string[] = [];
  const options = createChangelogOptions(cwd, {
    log: (msg: string) => logs.push(msg),
  });
  return { options, logs };
}
