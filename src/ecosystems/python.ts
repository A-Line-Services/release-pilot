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
  readonly supportsUnpublish = true;

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

  /**
   * Delete a specific version from PyPI
   *
   * Uses the PyPI JSON API to delete a release. Requires:
   * - PYPI_TOKEN environment variable with API token
   * - Token must have permissions to delete releases
   *
   * @param ctx - Ecosystem context
   * @param version - Version to delete
   * @returns true if deleted successfully
   */
  async unpublish(ctx: EcosystemContext, version: string): Promise<boolean> {
    if (ctx.dryRun) {
      ctx.log(`[dry-run] Would delete version ${version} from PyPI`);
      return true;
    }

    // Get package name from pyproject.toml
    const manifestPath = this.getManifestPath(ctx);
    const { readFileSync } = await import('node:fs');
    const content = readFileSync(manifestPath, 'utf-8');

    // Extract package name
    let packageName: string | null = null;

    // Try [project] section first
    const projectMatch = content.match(/\[project\][^[]*name\s*=\s*"([^"]+)"/s);
    if (projectMatch?.[1]) {
      packageName = projectMatch[1];
    }

    // Try [tool.poetry] section
    if (!packageName) {
      const poetryMatch = content.match(/\[tool\.poetry\][^[]*name\s*=\s*"([^"]+)"/s);
      if (poetryMatch?.[1]) {
        packageName = poetryMatch[1];
      }
    }

    if (!packageName) {
      ctx.log('Cannot delete from PyPI: package name not found in pyproject.toml');
      return false;
    }

    // Get PyPI token from environment
    const pypiToken = process.env.PYPI_TOKEN || process.env.TWINE_PASSWORD;
    if (!pypiToken) {
      ctx.log('Cannot delete from PyPI: PYPI_TOKEN environment variable not set');
      return false;
    }

    try {
      // PyPI API endpoint to delete a release
      // POST https://pypi.org/manage/project/{project}/release/{version}/
      // with _method=delete
      const response = await fetch(
        `https://pypi.org/manage/project/${packageName}/release/${version}/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pypiToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `_method=delete&confirm_project_name=${encodeURIComponent(packageName)}`,
        }
      );

      if (response.ok || response.status === 302) {
        ctx.log(`Deleted ${packageName}@${version} from PyPI`);
        return true;
      }

      ctx.log(`Failed to delete from PyPI: HTTP ${response.status}`);
      return false;
    } catch (error) {
      ctx.log(`Failed to delete ${packageName}@${version} from PyPI: ${error}`);
      return false;
    }
  }
}
