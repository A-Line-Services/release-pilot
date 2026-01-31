/**
 * Ecosystem Base Interface and Registry
 *
 * Defines the contract for package ecosystem implementations and provides
 * a registry for managing multiple ecosystems.
 *
 * @module ecosystems/base
 */

/**
 * Context passed to ecosystem methods
 */
export interface EcosystemContext {
  /** Path to the package directory */
  path: string;
  /** Custom version file path (overrides ecosystem default) */
  versionFile?: string;
  /** Whether this is a dry run (no actual changes) */
  dryRun: boolean;
  /** Logger for output */
  log: (message: string) => void;
}

/**
 * Interface that all ecosystem implementations must follow
 *
 * Ecosystems handle reading/writing versions and publishing packages
 * for specific package managers (npm, cargo, etc.)
 */
export interface Ecosystem {
  /** Unique identifier for this ecosystem (e.g., 'npm', 'cargo') */
  readonly name: string;

  /**
   * Detect if this ecosystem applies to a given path
   *
   * @param path - Directory path to check
   * @returns True if this ecosystem's manifest file exists
   *
   * @example
   * // npm ecosystem checks for package.json
   * await ecosystem.detect('./my-project') // true if package.json exists
   */
  detect(path: string): Promise<boolean>;

  /**
   * Read the current version from the package manifest
   *
   * @param ctx - Ecosystem context
   * @returns Current version string
   * @throws Error if version cannot be read
   *
   * @example
   * const version = await ecosystem.readVersion(ctx);
   * // "1.2.3"
   */
  readVersion(ctx: EcosystemContext): Promise<string>;

  /**
   * Write a new version to the package manifest
   *
   * @param ctx - Ecosystem context
   * @param version - New version to write
   * @throws Error if version cannot be written
   *
   * @example
   * await ecosystem.writeVersion(ctx, '1.3.0');
   */
  writeVersion(ctx: EcosystemContext, version: string): Promise<void>;

  /**
   * Get list of files that should be committed after version update
   *
   * @param ctx - Ecosystem context
   * @returns Array of file paths relative to package directory
   *
   * @example
   * const files = await ecosystem.getVersionFiles(ctx);
   * // ['package.json', 'package-lock.json']
   */
  getVersionFiles(ctx: EcosystemContext): Promise<string[]>;

  /**
   * Publish the package to its registry (optional)
   *
   * Not all ecosystems support publishing (e.g., Go uses git tags only).
   * If not implemented, the orchestrator will skip the publish step.
   *
   * @param ctx - Ecosystem context
   * @throws Error if publishing fails
   *
   * @example
   * await ecosystem.publish?.(ctx);
   */
  publish?(ctx: EcosystemContext): Promise<void>;

  /**
   * Hook called after version is updated (optional)
   *
   * Useful for updating lockfiles or other post-version tasks.
   *
   * @param ctx - Ecosystem context
   *
   * @example
   * // npm ecosystem might run 'npm install' to update lockfile
   * await ecosystem.postVersionUpdate?.(ctx);
   */
  postVersionUpdate?(ctx: EcosystemContext): Promise<void>;
}

/**
 * Registry for managing ecosystem implementations
 *
 * Provides methods to register, retrieve, and detect ecosystems.
 *
 * @example
 * const registry = new EcosystemRegistry();
 * registry.register(new NpmEcosystem());
 * registry.register(new CargoEcosystem());
 *
 * const ecosystem = registry.get('npm');
 * const detected = await registry.detect('./my-project');
 */
export class EcosystemRegistry {
  private ecosystems: Map<string, Ecosystem> = new Map();

  /**
   * Register an ecosystem implementation
   *
   * @param ecosystem - Ecosystem instance to register
   *
   * @example
   * registry.register(new NpmEcosystem());
   */
  register(ecosystem: Ecosystem): void {
    this.ecosystems.set(ecosystem.name, ecosystem);
  }

  /**
   * Get an ecosystem by name
   *
   * @param name - Ecosystem name
   * @returns Ecosystem instance or undefined if not found
   *
   * @example
   * const npm = registry.get('npm');
   */
  get(name: string): Ecosystem | undefined {
    return this.ecosystems.get(name);
  }

  /**
   * List all registered ecosystem names
   *
   * @returns Array of ecosystem names
   *
   * @example
   * const names = registry.list();
   * // ['npm', 'cargo', 'python', ...]
   */
  list(): string[] {
    return Array.from(this.ecosystems.keys());
  }

  /**
   * Detect which ecosystem applies to a path
   *
   * Checks each registered ecosystem until one matches.
   *
   * @param path - Directory path to check
   * @returns First matching ecosystem or null
   *
   * @example
   * const ecosystem = await registry.detect('./my-npm-project');
   * // NpmEcosystem instance
   */
  async detect(path: string): Promise<Ecosystem | null> {
    for (const ecosystem of this.ecosystems.values()) {
      if (await ecosystem.detect(path)) {
        return ecosystem;
      }
    }
    return null;
  }
}

/**
 * Create the default ecosystem registry with all built-in ecosystems
 *
 * @returns Configured registry with npm, cargo, python, go, composer, docker, custom
 */
export function createDefaultRegistry(): EcosystemRegistry {
  const registry = new EcosystemRegistry();

  // TODO: Register all ecosystems when implemented
  // registry.register(new NpmEcosystem());
  // registry.register(new CargoEcosystem());
  // registry.register(new PythonEcosystem());
  // registry.register(new GoEcosystem());
  // registry.register(new ComposerEcosystem());
  // registry.register(new DockerEcosystem());
  // registry.register(new CustomEcosystem());

  return registry;
}
