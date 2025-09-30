const axios = require('axios');

const githubCache = new Map();
const GITHUB_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class GitHubService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.apiBase = 'https://api.github.com';
    this.client = axios.create({
      baseURL: this.apiBase,
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 10000 
    });
    this.client.interceptors.request.use(async (config) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return config;
    });

    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
          const resetTime = error.response.headers['x-ratelimit-reset'];
          console.warn(`GitHub API rate limit exceeded. Resets at ${new Date(resetTime * 1000)}`);
        }
        return Promise.reject(error);
      }
    );
  }
  getCached(key) {
    const cached = githubCache.get(key);
    if (cached && Date.now() - cached.timestamp < GITHUB_CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  setCached(key, data) {
    githubCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  async getUserRepositories() {
    try {
      const response = await this.client.get('/user/repos', {
        params: {
          type: 'all',
          sort: 'updated',
          per_page: 100
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch repositories: ${error.message}`);
    }
  }

  async getRepositoryBranches(owner, repo) {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/branches`);
      return response.data.map(branch => ({
        id: `${owner}/${repo}/branch/${branch.name}`,
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url
        },
        html_url: `https://github.com/${owner}/${repo}/tree/${branch.name}`,
        url: `https://api.github.com/repos/${owner}/${repo}/branches/${branch.name}`
      }));
    } catch (error) {
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }
  }

  async getRepositoryPullRequests(owner, repo, options = {}) {
    try {
      const { state = 'open', page = 1, per_page = 30 } = options;
      const response = await this.client.get(`/repos/${owner}/${repo}/pulls`, {
        params: { state, page, per_page }
      });
      return response.data.map(pr => ({
        id: pr.id,
        number: pr.number,
        state: pr.state,
        title: pr.title,
        body: pr.body,
        html_url: pr.html_url,
        url: pr.url,
        user: {
          login: pr.user.login,
          avatar_url: pr.user.avatar_url
        },
        created_at: pr.created_at,
        updated_at: pr.updated_at
      }));
    } catch (error) {
      throw new Error(`Failed to fetch pull requests: ${error.message}`);
    }
  }

  async getRepositoryIssues(owner, repo, options = {}) {
    try {
      const { state = 'open', page = 1, per_page = 30 } = options;
      const response = await this.client.get(`/repos/${owner}/${repo}/issues`, {
        params: { state, page, per_page }
      });
      const issues = response.data.filter(item => !item.pull_request);
      return issues.map(issue => ({
        id: issue.id,
        number: issue.number,
        state: issue.state,
        title: issue.title,
        body: issue.body,
        html_url: issue.html_url,
        url: issue.url,
        user: {
          login: issue.user.login,
          avatar_url: issue.user.avatar_url
        },
        created_at: issue.created_at,
        updated_at: issue.updated_at
      }));
    } catch (error) {
      throw new Error(`Failed to fetch issues: ${error.message}`);
    }
  }

  async getRepositoryCommits(owner, repo, options = {}) {
    try {
      const { sha, since, until, page = 1, per_page = 30 } = options;
      const params = { page, per_page };
      if (sha) params.sha = sha;
      if (since) params.since = since;
      if (until) params.until = until;

      const response = await this.client.get(`/repos/${owner}/${repo}/commits`, { params });
      return response.data.map(commit => ({
        id: commit.sha,
        sha: commit.sha,
        html_url: commit.html_url,
        url: commit.url,
        commit: {
          message: commit.commit.message,
          author: {
            name: commit.commit.author.name,
            email: commit.commit.author.email,
            date: commit.commit.author.date
          }
        },
        author: commit.author ? {
          login: commit.author.login,
          avatar_url: commit.author.avatar_url
        } : null
      }));
    } catch (error) {
      throw new Error(`Failed to fetch commits: ${error.message}`);
    }
  }

  async getRepositoryInfo(ownerOrRepoId, repo = null) {
    try {
      let owner, repoName;
      
      if (repo === null) {
        const parts = ownerOrRepoId.split('/');
        if (parts.length !== 2) {
          throw new Error('Repository ID must be in format "owner/repo"');
        }
        [owner, repoName] = parts;
      } else {
        // Two parameters: owner and repo
        owner = ownerOrRepoId;
        repoName = repo;
      }

      const [branches, pulls, issues, commits] = await Promise.all([
        this.getRepositoryBranches(owner, repoName),
        this.getRepositoryPullRequests(owner, repoName),
        this.getRepositoryIssues(owner, repoName),
        this.getRepositoryCommits(owner, repoName)
      ]);

      return {
        repositoryId: `${owner}/${repoName}`,
        owner,
        repoName,
        branches,
        pulls,
        issues,
        commits
      };
    } catch (error) {
      throw new Error(`Failed to fetch repository info: ${error.message}`);
    }
  }

  static async exchangeCodeForToken(code) {
    try {
      const response = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code
      }, {
        headers: {
          'Accept': 'application/json'
        }
      });

      return response.data.access_token;
    } catch (error) {
      throw new Error(`Failed to exchange code for token: ${error.message}`);
    }
  }

  // Get GitHub user information
  static async getGitHubUser(accessToken) {
    try {
      const response = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      return {
        id: response.data.id,
        login: response.data.login,
        email: response.data.email,
        name: response.data.name,
        avatar_url: response.data.avatar_url
      };
    } catch (error) {
      throw new Error(`Failed to get GitHub user: ${error.message}`);
    }
  }

  // Search repositories
  async searchRepositories(query, options = {}) {
    try {
      const { sort = 'updated', order = 'desc', page = 1, per_page = 30 } = options;
      const response = await this.client.get('/search/repositories', {
        params: { q: query, sort, order, page, per_page }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to search repositories: ${error.message}`);
    }
  }

  async getIssue(owner, repo, issueNumber) {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/issues/${issueNumber}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get issue: ${error.message}`);
    }
  }

  // Get specific pull request
  async getPullRequest(owner, repo, pullNumber) {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get pull request: ${error.message}`);
    }
  }

  // Get specific commit
  async getCommit(owner, repo, sha) {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/commits/${sha}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get commit: ${error.message}`);
    }
  }

  async getBranchesPaginated(owner, repo, options = {}) {
    try {
      const { page = 1, per_page = 20, search = '' } = options;
      const response = await this.client.get(`/repos/${owner}/${repo}/branches`, {
        params: { page, per_page }
      });
      
      const branchesWithCommitInfo = await Promise.all(
        response.data.map(async (branch) => {
          try {
            const commitResponse = await this.client.get(`/repos/${owner}/${repo}/commits/${branch.commit.sha}`);
            const commitData = commitResponse.data;
            
            return {
              id: `${owner}/${repo}/branch/${branch.name}`,
              name: branch.name,
              commit: {
                sha: branch.commit.sha,
                url: branch.commit.url,
                message: commitData.commit.message,
                author: commitData.author ? {
                  login: commitData.author.login,
                  name: commitData.commit.author.name,
                  avatar_url: commitData.author.avatar_url
                } : {
                  name: commitData.commit.author.name,
                  login: commitData.commit.author.name,
                  avatar_url: null
                },
                date: commitData.commit.author.date
              },
              html_url: `https://github.com/${owner}/${repo}/tree/${branch.name}`,
              url: `https://api.github.com/repos/${owner}/${repo}/branches/${branch.name}`
            };
          } catch (commitError) {
            // Fallback if commit details fail
            return {
              id: `${owner}/${repo}/branch/${branch.name}`,
              name: branch.name,
              commit: {
                sha: branch.commit.sha,
                url: branch.commit.url,
                message: 'Unable to fetch commit message',
                author: {
                  name: 'Unknown',
                  login: 'Unknown',
                  avatar_url: null
                },
                date: null
              },
              html_url: `https://github.com/${owner}/${repo}/tree/${branch.name}`,
              url: `https://api.github.com/repos/${owner}/${repo}/branches/${branch.name}`
            };
          }
        })
      );

      let branches = branchesWithCommitInfo;
      if (search) {
        branches = branches.filter(branch => 
          branch.name.toLowerCase().includes(search.toLowerCase())
        );
      }

      return {
        branches,
        total: branches.length,
        page: parseInt(page),
        per_page: parseInt(per_page),
        has_more: response.data.length === per_page
      };
    } catch (error) {
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }
  }

  // Get commits with pagination and search
  async getCommitsPaginated(owner, repo, options = {}) {
    try {
      const { page = 1, per_page = 20, sha, author, since } = options;
      const params = { page, per_page };
      if (sha) params.sha = sha;
      if (author) params.author = author;
      if (since) params.since = since;

      const response = await this.client.get(`/repos/${owner}/${repo}/commits`, { params });
      
      const commits = response.data.map(commit => ({
        id: commit.sha,
        sha: commit.sha,
        html_url: commit.html_url,
        url: commit.url,
        message: commit.commit.message,
        author: commit.author ? {
          login: commit.author.login,
          avatar_url: commit.author.avatar_url
        } : {
          login: commit.commit.author.name,
          avatar_url: null
        },
        date: commit.commit.author.date
      }));

      return {
        commits,
        total: commits.length,
        page: parseInt(page),
        per_page: parseInt(per_page),
        has_more: response.data.length === per_page
      };
    } catch (error) {
      throw new Error(`Failed to fetch commits: ${error.message}`);
    }
  }

  // Get issues with pagination and search
  async getIssuesPaginated(owner, repo, options = {}) {
    try {
      const { page = 1, per_page = 20, state = 'open', labels = '', search = '' } = options;
      const params = { page, per_page, state };
      if (labels) params.labels = labels;

      const response = await this.client.get(`/repos/${owner}/${repo}/issues`, { params });
      
      // Filter out pull requests and apply search
      let issues = response.data.filter(item => !item.pull_request);
      
      if (search) {
        issues = issues.filter(issue => 
          issue.title.toLowerCase().includes(search.toLowerCase()) ||
          (issue.body && issue.body.toLowerCase().includes(search.toLowerCase()))
        );
      }

      const formattedIssues = issues.map(issue => ({
        id: issue.id,
        issueNumber: issue.number,
        state: issue.state,
        title: issue.title,
        body: issue.body,
        html_url: issue.html_url,
        url: issue.url,
        user: {
          login: issue.user.login,
          avatar_url: issue.user.avatar_url
        },
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        labels: issue.labels.map(label => ({
          name: label.name,
          color: label.color
        }))
      }));

      return {
        issues: formattedIssues,
        total: formattedIssues.length,
        page: parseInt(page),
        per_page: parseInt(per_page),
        has_more: response.data.length === per_page
      };
    } catch (error) {
      throw new Error(`Failed to fetch issues: ${error.message}`);
    }
  }

  // Get pull requests with pagination and search
  async getPullRequestsPaginated(owner, repo, options = {}) {
    try {
      const { page = 1, per_page = 20, state = 'open', sort = 'updated', search = '' } = options;
      const params = { page, per_page, state, sort };

      const response = await this.client.get(`/repos/${owner}/${repo}/pulls`, { params });
      
      let pulls = response.data;
      
      if (search) {
        pulls = pulls.filter(pr => 
          pr.title.toLowerCase().includes(search.toLowerCase()) ||
          (pr.body && pr.body.toLowerCase().includes(search.toLowerCase()))
        );
      }

      const formattedPulls = pulls.map(pr => ({
        id: pr.id,
        pullNumber: pr.number,
        state: pr.state,
        title: pr.title,
        body: pr.body,
        html_url: pr.html_url,
        url: pr.url,
        user: {
          login: pr.user.login,
          avatar_url: pr.user.avatar_url
        },
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha
        },
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha
        }
      }));

      return {
        pulls: formattedPulls,
        total: formattedPulls.length,
        page: parseInt(page),
        per_page: parseInt(per_page),
        has_more: response.data.length === per_page
      };
    } catch (error) {
      throw new Error(`Failed to fetch pull requests: ${error.message}`);
    }
  }

  // Get metadata for a specific GitHub attachment
  async getAttachmentMetadata(owner, repo, type, githubId) {
    try {
      // Check cache first
      const cacheKey = `${owner}/${repo}/${type}/${githubId}`;
      const cached = this.getCached(cacheKey);
      if (cached) {
        return cached;
      }

      let result;
      switch (type) {
        case 'branch':
          const branchResponse = await this.client.get(`/repos/${owner}/${repo}/branches/${githubId}`);
          const commitResponse = await this.client.get(`/repos/${owner}/${repo}/commits/${branchResponse.data.commit.sha}`);
          const commitData = commitResponse.data;
          
          result = {
            type: 'branch',
            name: branchResponse.data.name,
            title: branchResponse.data.name,
            url: `https://github.com/${owner}/${repo}/tree/${branchResponse.data.name}`,
            avatarUrl: commitData.author?.avatar_url || null,
            author: {
              name: commitData.author?.login || commitData.commit.author.name,
              login: commitData.author?.login || commitData.commit.author.name,
              avatar_url: commitData.author?.avatar_url || null
            },
            lastCommit: {
              message: commitData.commit.message,
              sha: commitData.sha,
              date: commitData.commit.author.date
            }
          };
          break;

        case 'commit':
          const commit = await this.client.get(`/repos/${owner}/${repo}/commits/${githubId}`);
          result = {
            type: 'commit',
            sha: commit.data.sha,
            title: commit.data.commit.message.split('\n')[0], // First line as title
            url: commit.data.html_url,
            avatarUrl: commit.data.author?.avatar_url || null,
            author: {
              name: commit.data.author?.login || commit.data.commit.author.name,
              login: commit.data.author?.login || commit.data.commit.author.name,
              avatar_url: commit.data.author?.avatar_url || null
            },
            message: commit.data.commit.message,
            date: commit.data.commit.author.date
          };
          break;

        case 'issue':
          const issue = await this.client.get(`/repos/${owner}/${repo}/issues/${githubId}`);
          result = {
            type: 'issue',
            number: issue.data.number,
            title: issue.data.title,
            url: issue.data.html_url,
            avatarUrl: issue.data.user.avatar_url,
            author: {
              name: issue.data.user.login,
              login: issue.data.user.login,
              avatar_url: issue.data.user.avatar_url
            },
            state: issue.data.state,
            body: issue.data.body,
            createdAt: issue.data.created_at,
            updatedAt: issue.data.updated_at
          };
          break;

        case 'pull_request':
          const pr = await this.client.get(`/repos/${owner}/${repo}/pulls/${githubId}`);
          result = {
            type: 'pull_request',
            number: pr.data.number,
            title: pr.data.title,
            url: pr.data.html_url,
            avatarUrl: pr.data.user.avatar_url,
            author: {
              name: pr.data.user.login,
              login: pr.data.user.login,
              avatar_url: pr.data.user.avatar_url
            },
            state: pr.data.state,
            body: pr.data.body,
            createdAt: pr.data.created_at,
            updatedAt: pr.data.updated_at
          };
          break;

        default:
          throw new Error(`Unsupported attachment type: ${type}`);
      }

      if (result) {
        this.setCached(cacheKey, result);
      }
      return result;

    } catch (error) {
      throw new Error(`Failed to fetch metadata for ${type}: ${error.message}`);
    }
  }
}

// Create a service instance with token for export
const githubService = {
  getUserRepositories: (token) => new GitHubService(token).getUserRepositories(),
  getRepositoryBranches: (token, owner, repo) => new GitHubService(token).getRepositoryBranches(owner, repo),
  getRepositoryPullRequests: (token, owner, repo, options) => new GitHubService(token).getRepositoryPullRequests(owner, repo, options),
  getRepositoryIssues: (token, owner, repo, options) => new GitHubService(token).getRepositoryIssues(owner, repo, options),
  getRepositoryCommits: (token, owner, repo, options) => new GitHubService(token).getRepositoryCommits(owner, repo, options),
  getRepositoryInfo: (token, ownerOrRepoId, repo) => new GitHubService(token).getRepositoryInfo(ownerOrRepoId, repo),
  searchRepositories: (token, query, options) => new GitHubService(token).searchRepositories(query, options),
  getIssue: (token, owner, repo, issueNumber) => new GitHubService(token).getIssue(owner, repo, issueNumber),
  getPullRequest: (token, owner, repo, pullNumber) => new GitHubService(token).getPullRequest(owner, repo, pullNumber),
  getCommit: (token, owner, repo, sha) => new GitHubService(token).getCommit(owner, repo, sha),
  getBranchesPaginated: (token, owner, repo, options) => new GitHubService(token).getBranchesPaginated(owner, repo, options),
  getCommitsPaginated: (token, owner, repo, options) => new GitHubService(token).getCommitsPaginated(owner, repo, options),
  getIssuesPaginated: (token, owner, repo, options) => new GitHubService(token).getIssuesPaginated(owner, repo, options),
  getPullRequestsPaginated: (token, owner, repo, options) => new GitHubService(token).getPullRequestsPaginated(owner, repo, options),
  getAttachmentMetadata: (token, owner, repo, type, githubId) => new GitHubService(token).getAttachmentMetadata(owner, repo, type, githubId)
};

module.exports = { GitHubService, githubService };