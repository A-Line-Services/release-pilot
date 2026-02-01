/**
 * Test Helpers
 *
 * Re-exports all test utilities for convenient imports.
 *
 * @module tests/helpers
 *
 * @example
 * import {
 *   useTestDir,
 *   createContext,
 *   createTestProject,
 *   createChangelogPR,
 * } from '../../helpers/index.js';
 */

// Context factories
export {
  createContext,
  createContextWithLogs,
  createContextWithRegistry,
  createDryRunContext,
  noopLog,
} from './context.js';
// Test data factories
export {
  createBugfixPR,
  // Changelog options
  createChangelogOptions,
  createChangelogOptionsWithLogs,
  // PR factories
  createChangelogPR,
  createDevRelease,
  createFeaturePR,
  // Config factories
  createLabelConfig,
  createPullRequestInfo,
  // Release factories
  createRelease,
  createReleases,
  DEFAULT_LABEL_CONFIG,
} from './factories.js';
// Fixture management
export { getFixturePath, TestDir, useTestDir } from './fixtures.js';

// Project scaffolding
export { createTestProject, TestProject } from './project.js';
