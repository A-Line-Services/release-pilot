/**
 * Shared Types for Core Modules
 *
 * Common interfaces used across release-pilot core functionality.
 *
 * @module core/types
 */

/**
 * Base options for operations that interact with the filesystem
 *
 * This interface is extended by specific operation options like
 * GitOptions, ChangelogOptions, UpdateVersionFilesOptions, etc.
 */
export interface BaseOperationOptions {
  /** Base directory (usually repository root) */
  cwd: string;
  /** Whether this is a dry run (no actual changes) */
  dryRun: boolean;
  /** Logger function for info messages */
  log: (message: string) => void;
}

/**
 * Extended options with warning support
 *
 * Used by operations that need to report warnings separately from info logs.
 */
export interface BaseOperationOptionsWithWarn extends BaseOperationOptions {
  /** Logger function for warning messages */
  warn: (message: string) => void;
}
