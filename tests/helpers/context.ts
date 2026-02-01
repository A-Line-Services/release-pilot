/**
 * Test Context Factories
 *
 * Provides helpers for creating EcosystemContext objects in tests.
 *
 * @module tests/helpers/context
 */

import type { EcosystemContext, RegistryConfig } from '../../src/ecosystems/base.js';

/**
 * Default no-op logger for tests
 */
export const noopLog = (): void => {};

/**
 * Create an EcosystemContext for testing
 *
 * @param path - Path to the project directory
 * @param options - Optional overrides
 * @returns EcosystemContext for testing
 *
 * @example
 * const ctx = createContext('/path/to/project');
 * const ctx = createContext('/path', { dryRun: true });
 */
export function createContext(
  path: string,
  options: Partial<EcosystemContext> = {}
): EcosystemContext {
  return {
    path,
    dryRun: false,
    log: noopLog,
    ...options,
  };
}

/**
 * Create a context with log capture for testing log output
 *
 * @param path - Path to the project directory
 * @param options - Optional overrides (excluding log)
 * @returns Object with context and captured logs array
 *
 * @example
 * const { ctx, logs } = createContextWithLogs('/path');
 * await ecosystem.writeVersion(ctx, '1.0.0');
 * expect(logs).toContain('Updated version to 1.0.0');
 */
export function createContextWithLogs(
  path: string,
  options: Omit<Partial<EcosystemContext>, 'log'> = {}
): { ctx: EcosystemContext; logs: string[] } {
  const logs: string[] = [];
  const ctx = createContext(path, {
    ...options,
    log: (msg: string) => logs.push(msg),
  });
  return { ctx, logs };
}

/**
 * Create a dry-run context for testing
 *
 * @param path - Path to the project directory
 * @param options - Optional overrides
 * @returns EcosystemContext with dryRun: true
 */
export function createDryRunContext(
  path: string,
  options: Partial<EcosystemContext> = {}
): EcosystemContext {
  return createContext(path, { ...options, dryRun: true });
}

/**
 * Create a context with registry configuration
 *
 * @param path - Path to the project directory
 * @param registry - Registry configuration
 * @param options - Optional overrides
 */
export function createContextWithRegistry(
  path: string,
  registry: RegistryConfig,
  options: Partial<EcosystemContext> = {}
): EcosystemContext {
  return createContext(path, { ...options, registry });
}
