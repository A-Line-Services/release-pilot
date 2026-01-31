/**
 * GitHub API Client
 *
 * Provides a typed interface for GitHub API operations needed by Release Pilot.
 * Wraps @actions/github octokit with specific methods for release automation.
 *
 * @module github/client
 */

import * as github from '@actions/github';

type Octokit = ReturnType<typeof github.getOctokit>;

/**
 * Simplified release info
 */
export interface ReleaseInfo {
  id: number;
  tagName: string;
  publishedAt: string;
  prerelease: boolean;
}

/**
 * Simplified pull request info
 */
export interface PullRequestInfo {
  number: number;
  mergedAt: string | null;
  labels: string[];
}

/**
 * Created release response
 */
export interface CreatedRelease {
  id: number;
  htmlUrl: string;
  tagName: string;
}

/**
 * Options for creating a release
 */
export interface CreateReleaseOptions {
  tagName: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  generateReleaseNotes?: boolean;
}

/**
 * GitHub API client for release automation
 *
 * @example
 * const client = new GitHubClient(token, 'owner', 'repo');
 * const releases = await client.listReleases();
 * const prs = await client.listMergedPullRequests();
 */
export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.octokit = github.getOctokit(token);
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Create a client from the current GitHub context
   */
  static fromContext(token: string): GitHubClient {
    const { owner, repo } = github.context.repo;
    return new GitHubClient(token, owner, repo);
  }

  /**
   * List recent releases
   *
   * @param perPage - Number of releases to fetch (default 100)
   */
  async listReleases(perPage = 100): Promise<ReleaseInfo[]> {
    const { data: releases } = await this.octokit.rest.repos.listReleases({
      owner: this.owner,
      repo: this.repo,
      per_page: perPage,
    });

    return releases.map((r) => ({
      id: r.id,
      tagName: r.tag_name,
      publishedAt: r.published_at || '',
      prerelease: r.prerelease,
    }));
  }

  /**
   * List closed pull requests (includes merged)
   *
   * @param perPage - Number of PRs to fetch (default 100)
   */
  async listClosedPullRequests(perPage = 100): Promise<PullRequestInfo[]> {
    const { data: pulls } = await this.octokit.rest.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      per_page: perPage,
    });

    return pulls.map((pr) => ({
      number: pr.number,
      mergedAt: pr.merged_at,
      labels: pr.labels.map((l) => l.name || ''),
    }));
  }

  /**
   * List only merged pull requests
   *
   * @param perPage - Number of PRs to fetch (default 100)
   */
  async listMergedPullRequests(perPage = 100): Promise<PullRequestInfo[]> {
    const closed = await this.listClosedPullRequests(perPage);
    return closed.filter((pr) => pr.mergedAt !== null);
  }

  /**
   * Create a GitHub release
   */
  async createRelease(options: CreateReleaseOptions): Promise<CreatedRelease> {
    const { data: release } = await this.octokit.rest.repos.createRelease({
      owner: this.owner,
      repo: this.repo,
      tag_name: options.tagName,
      name: options.name ?? options.tagName,
      body: options.body,
      draft: options.draft ?? false,
      prerelease: options.prerelease ?? false,
      generate_release_notes: options.generateReleaseNotes ?? false,
    });

    return {
      id: release.id,
      htmlUrl: release.html_url,
      tagName: release.tag_name,
    };
  }

  /**
   * Delete a GitHub release by ID
   *
   * @param releaseId - The release ID to delete
   */
  async deleteRelease(releaseId: number): Promise<void> {
    await this.octokit.rest.repos.deleteRelease({
      owner: this.owner,
      repo: this.repo,
      release_id: releaseId,
    });
  }

  /**
   * Get repository owner
   */
  getOwner(): string {
    return this.owner;
  }

  /**
   * Get repository name
   */
  getRepo(): string {
    return this.repo;
  }
}
