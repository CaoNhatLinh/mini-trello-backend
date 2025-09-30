const express = require('express');
const router = express.Router();
const githubController = require('../controllers/githubController');
const { authenticateToken } = require('../middleware/auth');

// Get GitHub connection status
router.get('/status', 
  authenticateToken,
  githubController.getConnectionStatus
);

// Disconnect GitHub account
router.delete('/disconnect', 
  authenticateToken,
  githubController.disconnectGithub
);

// Get user's repositories
router.get('/repositories', 
  authenticateToken,
  githubController.getUserRepositories
);

// Search repositories
router.get('/repositories/search', 
  authenticateToken,
  githubController.searchRepositories
);

// Get specific repository information
router.get('/repositories/:owner/:repo', 
  authenticateToken,
  githubController.getRepositoryInfo
);

// Paginated endpoints (MUST come before general endpoints to avoid route conflicts)
router.get('/repositories/:owner/:repo/branches/paginated', 
  authenticateToken,
  githubController.getBranchesPaginated
);

router.get('/repositories/:owner/:repo/commits/paginated', 
  authenticateToken,
  githubController.getCommitsPaginated
);

router.get('/repositories/:owner/:repo/issues/paginated', 
  authenticateToken,
  githubController.getIssuesPaginated
);

router.get('/repositories/:owner/:repo/pulls/paginated', 
  authenticateToken,
  githubController.getPullRequestsPaginated
);

// Get repository branches
router.get('/repositories/:owner/:repo/branches', 
  authenticateToken,
  githubController.getRepositoryBranches
);

// Get repository issues
router.get('/repositories/:owner/:repo/issues', 
  authenticateToken,
  githubController.getRepositoryIssues
);

// Get specific issue details
router.get('/repositories/:owner/:repo/issues/:issue_number', 
  authenticateToken,
  githubController.getIssueDetails
);

// Get repository pull requests
router.get('/repositories/:owner/:repo/pulls', 
  authenticateToken,
  githubController.getRepositoryPullRequests
);

// Get specific pull request details
router.get('/repositories/:owner/:repo/pulls/:pull_number', 
  authenticateToken,
  githubController.getPullRequestDetails
);

// Get repository commits
router.get('/repositories/:owner/:repo/commits', 
  authenticateToken,
  githubController.getRepositoryCommits
);

// Get specific commit details
router.get('/repositories/:owner/:repo/commits/:sha', 
  authenticateToken,
  githubController.getCommitDetails
);

// Get repository GitHub info (with owner/repo pattern)
router.get('/repositories/:owner/:repo/github-info', 
  authenticateToken,
  githubController.getRepositoryGithubInfo
);

module.exports = router;
