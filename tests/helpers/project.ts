/**
 * Test Project Scaffolding
 *
 * Provides helpers for creating project structures in tests.
 *
 * @module tests/helpers/project
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fluent builder for creating test project structures
 *
 * @example
 * const project = new TestProject(TEST_DIR, 'my-project')
 *   .create()
 *   .withPackageJson({ version: '1.0.0' })
 *   .withFile('README.md', '# Hello');
 */
export class TestProject {
  readonly path: string;

  constructor(baseDir: string, name: string) {
    this.path = join(baseDir, name);
  }

  /** Create the project directory */
  create(): this {
    mkdirSync(this.path, { recursive: true });
    return this;
  }

  /** Write a file to the project */
  withFile(filename: string, content: string): this {
    writeFileSync(join(this.path, filename), content);
    return this;
  }

  /** Write a JSON file to the project */
  withJson(filename: string, data: object, indent = 2): this {
    return this.withFile(filename, JSON.stringify(data, null, indent));
  }

  /** Create a subdirectory */
  withDir(name: string): this {
    mkdirSync(join(this.path, name), { recursive: true });
    return this;
  }

  // =========================================================================
  // Ecosystem-specific helpers
  // =========================================================================

  /** Create a package.json file */
  withPackageJson(pkg: { name?: string; version?: string; [key: string]: unknown } = {}): this {
    return this.withJson('package.json', {
      name: 'test-package',
      version: '1.0.0',
      ...pkg,
    });
  }

  /** Create a Cargo.toml file */
  withCargoToml(options: { name?: string; version?: string } | string = {}): this {
    if (typeof options === 'string') {
      return this.withFile('Cargo.toml', options);
    }
    const { name = 'test-crate', version = '1.0.0' } = options;
    return this.withFile(
      'Cargo.toml',
      `[package]\nname = "${name}"\nversion = "${version}"\nedition = "2021"\n`
    );
  }

  /** Create a pyproject.toml file */
  withPyprojectToml(options: { name?: string; version?: string } | string = {}): this {
    if (typeof options === 'string') {
      return this.withFile('pyproject.toml', options);
    }
    const { name = 'test-package', version = '1.0.0' } = options;
    return this.withFile('pyproject.toml', `[project]\nname = "${name}"\nversion = "${version}"\n`);
  }

  /** Create a go.mod file */
  withGoMod(options: { module?: string; goVersion?: string } | string = {}): this {
    if (typeof options === 'string') {
      return this.withFile('go.mod', options);
    }
    const { module = 'example.com/test', goVersion = '1.21' } = options;
    return this.withFile('go.mod', `module ${module}\n\ngo ${goVersion}\n`);
  }

  /** Create a composer.json file */
  withComposerJson(pkg: { name?: string; version?: string; [key: string]: unknown } = {}): this {
    return this.withJson(
      'composer.json',
      {
        name: 'vendor/test',
        version: '1.0.0',
        ...pkg,
      },
      4
    );
  }

  /** Create a Dockerfile */
  withDockerfile(content = 'FROM node:20-alpine\n'): this {
    return this.withFile('Dockerfile', content);
  }

  /** Create a VERSION file */
  withVersionFile(version = '1.0.0', filename = 'VERSION'): this {
    return this.withFile(filename, `${version}\n`);
  }

  /** Create a CHANGELOG.md file */
  withChangelog(content?: string): this {
    return this.withFile(
      'CHANGELOG.md',
      content ?? `# Changelog\n\n## [1.0.0] - 2024-01-01\n\n- Initial release\n`
    );
  }
}

/**
 * Create a test project with directory already created
 *
 * @example
 * const project = createTestProject(TEST_DIR, 'npm-test')
 *   .withPackageJson({ version: '2.0.0' });
 */
export function createTestProject(baseDir: string, name: string): TestProject {
  return new TestProject(baseDir, name).create();
}
