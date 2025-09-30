const { GitHubService, githubService } = require('../services/githubService');
const User = require('../models/User');

const githubController = {
  // Get user's GitHub repositories
  async getUserRepositories(req, res) {
    try {
      const userId = req.user.uid;
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }
      const repositories = await githubService.getUserRepositories(user.githubAccessToken);

      res.json({
        success: true,
        repositories,
        count: repositories.length
      });
    } catch (error) {
      console.error('Get repositories error:', error);
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          message: 'Please reconnect your GitHub account',
          action: 'reconnect_github'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch repositories',
        message: error.message
      });
    }
  },
async getRepositoryGithubInfo(req, res) {
    try {
      const { owner, repo } = req.params;
      const userId = req.user.uid;
      const User = require('../models/User');
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }

      try {
        const githubInfo = await githubService.getRepositoryInfo(user.githubAccessToken, owner, repo);
        res.json({
          success: true,
          repository: `${owner}/${repo}`,
          githubInfo
        });
      } catch (githubError) {
        console.error('GitHub API error:', githubError);
        return res.status(404).json({
          error: 'Repository not found',
          message: 'Could not fetch GitHub information for this repository'
        });
      }
    } catch (error) {
      console.error('Get repository GitHub info error:', error);
      res.status(500).json({
        error: 'Failed to fetch repository information',
        message: error.message
      });
    }
  },
  // Get repository information
  async getRepositoryInfo(req, res) {
    try {
      const { owner, repo } = req.params;
      const userId = req.user.uid;
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }

      const repoInfo = await githubService.getRepositoryInfo(user.githubAccessToken, owner, repo);

      res.json({
        success: true,
        repository: repoInfo
      });
    } catch (error) {
      console.error('Get repository info error:', error);
      if (error.message.includes('404')) {
        return res.status(404).json({
          error: 'Repository not found',
          message: 'The requested repository does not exist or you do not have access'
        });
      }
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          action: 'reconnect_github',
          message: 'Please reconnect your GitHub account'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch repository information',
        message: error.message
      });
    }
  },

  // Get repository branches
  async getRepositoryBranches(req, res) {
    try {
      const { owner, repo } = req.params;
      const userId = req.user.uid;
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }

      const branches = await githubService.getRepositoryBranches(user.githubAccessToken, owner, repo);

      res.json({
        success: true,
        branches,
        count: branches.length
      });
    } catch (error) {
      console.error('Get repository branches error:', error);
      if (error.message.includes('404')) {
        return res.status(404).json({
          error: 'Repository not found',
          message: 'The requested repository does not exist or you do not have access'
        });
      }
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          action: 'reconnect_github',
          message: 'Please reconnect your GitHub account'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch repository branches',
        message: error.message
      });
    }
  },

  // Get repository issues
  async getRepositoryIssues(req, res) {
    try {
      const { owner, repo } = req.params;
      const { state = 'open', page = 1, per_page = 30 } = req.query;
      const userId = req.user.uid;
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }

      const issues = await githubService.getRepositoryIssues(
        user.githubAccessToken, 
        owner, 
        repo, 
        { state, page: parseInt(page), per_page: parseInt(per_page) }
      );
      res.json({
        success: true,
        issues,
        count: issues.length,
        pagination: {
          page: parseInt(page),
          per_page: parseInt(per_page),
          state
        }
      });
    } catch (error) {
      console.error('Get repository issues error:', error);
      if (error.message.includes('404')) {
        return res.status(404).json({
          error: 'Repository not found',
          message: 'The requested repository does not exist or you do not have access'
        });
      }
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          action: 'reconnect_github',
          message: 'Please reconnect your GitHub account'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch repository issues',
        message: error.message
      });
    }
  },
  // Get repository pull requests
  async getRepositoryPullRequests(req, res) {
    try {
      const { owner, repo } = req.params;
      const { state = 'open', page = 1, per_page = 30 } = req.query;
      const userId = req.user.uid;
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }

      const pullRequests = await githubService.getRepositoryPullRequests(
        user.githubAccessToken, 
        owner, 
        repo, 
        { state, page: parseInt(page), per_page: parseInt(per_page) }
      );
      res.json({
        success: true,
        pullRequests,
        count: pullRequests.length,
        pagination: {
          page: parseInt(page),
          per_page: parseInt(per_page),
          state
        }
      });
    } catch (error) {
      console.error('Get repository pull requests error:', error);
      if (error.message.includes('404')) {
        return res.status(404).json({
          error: 'Repository not found',
          message: 'The requested repository does not exist or you do not have access'
        });
      }
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          action: 'reconnect_github',
          message: 'Please reconnect your GitHub account'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch repository pull requests',
        message: error.message
      });
    }
  },

  // Get repository commits
  async getRepositoryCommits(req, res) {
    try {
      const { owner, repo } = req.params;
      const { sha, since, until, page = 1, per_page = 30 } = req.query;
      const userId = req.user.uid;
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }

      const commits = await githubService.getRepositoryCommits(
        user.githubAccessToken, 
        owner, 
        repo, 
        { sha, since, until, page: parseInt(page), per_page: parseInt(per_page) }
      );

      res.json({
        success: true,
        commits,
        count: commits.length,
        pagination: {
          page: parseInt(page),
          per_page: parseInt(per_page),
          sha,
          since,
          until
        }
      });
    } catch (error) {
      console.error('Get repository commits error:', error);
      if (error.message.includes('404')) {
        return res.status(404).json({
          error: 'Repository not found',
          message: 'The requested repository does not exist or you do not have access'
        });
      }
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          action: 'reconnect_github',
          message: 'Please reconnect your GitHub account'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch repository commits',
        message: error.message
      });
    }
  },

  // Get specific issue details
  async getIssueDetails(req, res) {
    try {
      const { owner, repo, issue_number } = req.params;
      const userId = req.user.uid;
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }
      const issue = await githubService.getIssue(user.githubAccessToken, owner, repo, parseInt(issue_number));

      res.json({
        success: true,
        issue
      });
    } catch (error) {
      console.error('Get issue details error:', error);
      if (error.message.includes('404')) {
        return res.status(404).json({
          error: 'Issue not found',
          message: 'The requested issue does not exist or you do not have access'
        });
      }
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          action: 'reconnect_github',
          message: 'Please reconnect your GitHub account'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch issue details',
        message: error.message
      });
    }
  },

  // Get specific pull request details
  async getPullRequestDetails(req, res) {
    try {
      const { owner, repo, pull_number } = req.params;
      const userId = req.user.uid;
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }

      const pullRequest = await githubService.getPullRequest(user.githubAccessToken, owner, repo, parseInt(pull_number));

      res.json({
        success: true,
        pullRequest
      });
    } catch (error) {
      console.error('Get pull request details error:', error);
      if (error.message.includes('404')) {
        return res.status(404).json({
          error: 'Pull request not found',
          message: 'The requested pull request does not exist or you do not have access'
        });
      }
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          action: 'reconnect_github',
          message: 'Please reconnect your GitHub account'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch pull request details',
        message: error.message
      });
    }
  },
  // Get specific commit details
  async getCommitDetails(req, res) {
    try {
      const { owner, repo, sha } = req.params;
      const userId = req.user.uid;
      
      // Get user to check for GitHub token
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }
      const commit = await githubService.getCommit(user.githubAccessToken, owner, repo, sha);

      res.json({
        success: true,
        commit
      });
    } catch (error) {
      console.error('Get commit details error:', error);
      if (error.message.includes('404')) {
        return res.status(404).json({
          error: 'Commit not found',
          message: 'The requested commit does not exist or you do not have access'
        });
      }
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          action: 'reconnect_github',
          message: 'Please reconnect your GitHub account'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch commit details',
        message: error.message
      });
    }
  },

  // Search repositories
  async searchRepositories(req, res) {
    try {
      const { q, sort = 'updated', order = 'desc', page = 1, per_page = 30 } = req.query;
      const userId = req.user.uid;
      
      if (!q) {
        return res.status(400).json({
          error: 'Missing query parameter',
          message: 'Please provide a search query'
        });
      }

      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }

      const searchResults = await githubService.searchRepositories(
        user.githubAccessToken,
        q,
        { sort, order, page: parseInt(page), per_page: parseInt(per_page) }
      );

      res.json({
        success: true,
        repositories: searchResults.items,
        total_count: searchResults.total_count,
        pagination: {
          page: parseInt(page),
          per_page: parseInt(per_page),
          sort,
          order
        }
      });
    } catch (error) {
      console.error('Search repositories error:', error);
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          action: 'reconnect_github',
          message: 'Please reconnect your GitHub account'
        });
      }
      res.status(500).json({
        error: 'Failed to search repositories',
        message: error.message
      });
    }
  },

  // Check GitHub connection status
  async getConnectionStatus(req, res) {
    try {
      const userId = req.user.uid;
      
      const user = await User.findById(userId);
      const isConnected = !!(user && user.githubAccessToken && user.githubProfile);

      res.json({
        success: true,
        connected: isConnected,
        username: user?.githubProfile?.login || null,
        connectedAt: user?.createdAt || null
      });
    } catch (error) {
      console.error('Get connection status error:', error);
      res.status(500).json({
        error: 'Failed to check GitHub connection status',
        message: error.message
      });
    }
  },
  async disconnectGithub(req, res) {
    try {
      const userId = req.user.uid;

      await User.update(userId, {
        githubAccessToken: null,
        githubProfile: null
      });

      res.json({
        success: true,
        message: 'GitHub account disconnected successfully'
      });
    } catch (error) {
      console.error('Disconnect GitHub error:', error);
      res.status(500).json({
        error: 'Failed to disconnect GitHub account',
        message: error.message
      });
    }
  },

  async getBranchesPaginated(req, res) {
    try {
      const { owner, repo } = req.params;
      const { page = 1, per_page = 20, search = '' } = req.query;
      const userId = req.user.uid;
      
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }

      const result = await githubService.getBranchesPaginated(
        user.githubAccessToken, 
        owner, 
        repo, 
        { page: parseInt(page), per_page: parseInt(per_page), search }
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get branches paginated error:', error);
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          message: 'Please reconnect your GitHub account',
          action: 'reconnect_github'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch branches',
        message: error.message
      });
    }
  },

  async getCommitsPaginated(req, res) {
    try {
      const { owner, repo } = req.params;
      const { page = 1, per_page = 20, sha = '', author = '', since = '' } = req.query;
      const userId = req.user.uid;
      
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }

      const result = await githubService.getCommitsPaginated(
        user.githubAccessToken, 
        owner, 
        repo, 
        { page: parseInt(page), per_page: parseInt(per_page), sha, author, since }
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get commits paginated error:', error);
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          message: 'Please reconnect your GitHub account',
          action: 'reconnect_github'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch commits',
        message: error.message
      });
    }
  },
  async getIssuesPaginated(req, res) {
    try {
      const { owner, repo } = req.params;
      const { page = 1, per_page = 20, state = 'open', labels = '', search = '' } = req.query;
      const userId = req.user.uid;
      
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }

      const result = await githubService.getIssuesPaginated(
        user.githubAccessToken, 
        owner, 
        repo, 
        { page: parseInt(page), per_page: parseInt(per_page), state, labels, search }
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get issues paginated error:', error);
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          message: 'Please reconnect your GitHub account',
          action: 'reconnect_github'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch issues',
        message: error.message
      });
    }
  },

  // Get repository pull requests with pagination and search
  async getPullRequestsPaginated(req, res) {
    try {
      const { owner, repo } = req.params;
      const { page = 1, per_page = 20, state = 'open', sort = 'updated', search = '' } = req.query;
      const userId = req.user.uid;
      
      const user = await User.findById(userId);
      if (!user || !user.githubAccessToken) {
        return res.status(400).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first',
          action: 'connect_github'
        });
      }

      const result = await githubService.getPullRequestsPaginated(
        user.githubAccessToken, 
        owner, 
        repo, 
        { page: parseInt(page), per_page: parseInt(per_page), state, sort, search }
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get pull requests paginated error:', error);
      if (error.message.includes('401')) {
        return res.status(400).json({
          error: 'GitHub authentication failed',
          message: 'Please reconnect your GitHub account',
          action: 'reconnect_github'
        });
      }
      res.status(500).json({
        error: 'Failed to fetch pull requests',
        message: error.message
      });
    }
  }
};

module.exports = githubController;
