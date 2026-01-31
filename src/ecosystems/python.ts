/**
 * Python Ecosystem Implementation
 *
 * Handles version management for Python packages using pyproject.toml.
 *
 * @module ecosystems/python
 */

import { BaseFileEcosystem, type EcosystemContext } from './base.js';

/**
 * Python ecosystem implementation
 *
 * Supports:
 * - Reading/writing version in pyproject.toml
 * - Publishing via `uv publish` or `twine upload`
 *
 * @example
 * const python = new PythonEcosystem();
 * const version = await python.readVersion(ctx);
 * await python.writeVersion(ctx, '1.2.0');
 */
export class PythonEcosystem extends BaseFileEcosystem {
  readonly name = 'python';

  constructor() {
    super({
      manifestFile: 'pyproject.toml',
      lockFiles: ['uv.lock', 'poetry.lock', 'pdm.lock'],
    });
  }

  /**
   * Publish package to PyPI
   *
   * Prefers uv if available, falls back to twine.
   */
  async publish(ctx: EcosystemContext): Promise<void> {
    if (ctx.dryRun) {
      ctx.log('[dry-run] Would run: uv publish or twine upload');
      return;
    }

    const { exec, getExecOutput } = await import('@actions/exec');

    // Check if uv is available
    let useUv = false;
    try {
      await getExecOutput('uv', ['--version'], { silent: true });
      useUv = true;
    } catch {
      // uv not available
    }

    if (useUv) {
      // Build and publish with uv
      await exec('uv', ['build'], { cwd: ctx.path });
      await exec('uv', ['publish'], { cwd: ctx.path });
      ctx.log('Published to PyPI using uv');
    } else {
      // Fall back to build + twine
      await exec('python', ['-m', 'build'], { cwd: ctx.path });
      await exec('python', ['-m', 'twine', 'upload', 'dist/*'], { cwd: ctx.path });
      ctx.log('Published to PyPI using twine');
    }
  }

  /**
   * Parse version from pyproject.toml content
   *
   * Supports both [project] and [tool.poetry] sections.
   */
  protected parseVersion(content: string): string | null {
    // Try [project] section first (PEP 621)
    const projectMatch = content.match(/\[project\][^[]*version\s*=\s*"([^"]+)"/s);
    if (projectMatch?.[1]) {
      return projectMatch[1];
    }

    // Try [tool.poetry] section
    const poetryMatch = content.match(/\[tool\.poetry\][^[]*version\s*=\s*"([^"]+)"/s);
    if (poetryMatch?.[1]) {
      return poetryMatch[1];
    }

    return null;
  }

  /**
   * Update version in pyproject.toml content
   *
   * Updates [project] section if present, otherwise [tool.poetry].
   */
  protected updateVersion(content: string, version: string): string {
    // Try [project] section first
    if (content.includes('[project]')) {
      const regex = /(\[project\][^[]*version\s*=\s*)"[^"]*"/s;
      if (regex.test(content)) {
        return content.replace(regex, `$1"${version}"`);
      }
    }

    // Try [tool.poetry] section
    if (content.includes('[tool.poetry]')) {
      const regex = /(\[tool\.poetry\][^[]*version\s*=\s*)"[^"]*"/s;
      if (regex.test(content)) {
        return content.replace(regex, `$1"${version}"`);
      }
    }

    return content;
  }
}
