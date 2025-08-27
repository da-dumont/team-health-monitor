const { Octokit } = require('@octokit/rest');
const CacheManager = require('./cache-manager');
const RateLimiter = require('./rate-limiter');
require('dotenv').config();

class GitHubClient {
  constructor(options = {}) {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
    
    this.cache = new CacheManager({
      enabled: options.cache !== false,
      maxAge: options.cacheMaxAge || 4 * 60 * 60 * 1000, // 4 hours default
      cacheDir: options.cacheDir
    });
    
    this.rateLimiter = new RateLimiter({
      requestsPerHour: options.requestsPerHour || 4500,
      burstLimit: options.burstLimit || 100
    });
    
    this.requestsThisRun = 0;
  }

  async makeRequest(requestFn, cacheKey = null) {
    // Check cache first
    if (cacheKey) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== null) {
        this.rateLimiter.recordRequest(true);
        return cached;
      }
    }
    
    // Wait if rate limited
    await this.rateLimiter.waitIfNeeded();
    
    try {
      const response = await requestFn();
      this.rateLimiter.recordRequest(false);
      this.requestsThisRun++;
      
      // Handle rate limit headers
      if (response.headers) {
        const remaining = parseInt(response.headers['x-ratelimit-remaining']);
        const reset = parseInt(response.headers['x-ratelimit-reset']);
        
        if (remaining <= 10 && reset) {
          this.rateLimiter.handleRateLimitResponse(reset);
        }
      }
      
      const data = response.data;
      
      // Cache the result
      if (cacheKey && data) {
        await this.cache.set(cacheKey, data);
      }
      
      return data;
      
    } catch (error) {
      if (error.status === 403 && error.message.includes('rate limit')) {
        const resetTime = error.response?.headers?.['x-ratelimit-reset'];
        if (resetTime) {
          this.rateLimiter.handleRateLimitResponse(parseInt(resetTime));
        }
        // Retry after waiting
        await this.rateLimiter.waitIfNeeded();
        return this.makeRequest(requestFn, cacheKey);
      }
      throw error;
    }
  }
  
  async getPullRequests(owner, repo, since, until) {
    console.log(`📥 Fetching PRs for ${owner}/${repo}...`);
    
    const cacheKey = this.cache.paginatedKey('pulls', owner, repo, {
      since: since.toISOString().split('T')[0],
      until: until.toISOString().split('T')[0],
      state: 'closed'
    });
    
    return this.cache.getOrSet(cacheKey, async () => {
      const pulls = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const data = await this.makeRequest(() => 
          this.octokit.pulls.list({
            owner,
            repo,
            state: 'closed',
            sort: 'updated',
            direction: 'desc',
            per_page: 100,
            page
          })
        );

        const filteredPulls = data.filter(pr => {
          const createdAt = new Date(pr.created_at);
          return createdAt >= since && createdAt <= until;
        });

        pulls.push(...filteredPulls);

        // Stop if we got less than a full page or no relevant PRs
        hasMore = data.length === 100 && filteredPulls.length > 0;
        
        if (hasMore) {
          page++;
          // Progress indicator for large repositories
          if (page % 5 === 0) {
            console.log(`  📄 Fetched ${pulls.length} PRs (page ${page})...`);
          }
        }
      }
      
      console.log(`  ✅ Found ${pulls.length} PRs`);
      return pulls;
    });
  }

  async getPullRequestDetails(owner, repo, pullNumber, prUpdatedAt = null) {
    const cacheKey = prUpdatedAt ? 
      this.cache.prDetailsKey(owner, repo, pullNumber, prUpdatedAt) : null;
    
    if (cacheKey) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.rateLimiter.recordRequest(true);
        return cached;
      }
    }
    
    // Batch the requests but make them sequentially to avoid overwhelming API
    const prDetails = await this.makeRequest(() => 
      this.octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber
      })
    );
    
    // Small delay between requests to be gentle on API
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const reviews = await this.makeRequest(() => 
      this.octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: pullNumber
      })
    );
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const commits = await this.makeRequest(() => 
      this.octokit.pulls.listCommits({
        owner,
        repo,
        pull_number: pullNumber
      })
    );

    const result = {
      ...prDetails,
      reviews: reviews,
      commits: commits
    };
    
    // Cache the result
    if (cacheKey) {
      await this.cache.set(cacheKey, result);
    }
    
    return result;
  }

  async getCommits(owner, repo, since, until) {
    console.log(`📊 Fetching commits for ${owner}/${repo}...`);
    
    const cacheKey = this.cache.paginatedKey('commits', owner, repo, {
      since: since.toISOString().split('T')[0],
      until: until.toISOString().split('T')[0]
    });
    
    return this.cache.getOrSet(cacheKey, async () => {
      const commits = [];
      let page = 1;
      
      while (true) {
        const data = await this.makeRequest(() => 
          this.octokit.repos.listCommits({
            owner,
            repo,
            since: since.toISOString(),
            until: until.toISOString(),
            per_page: 100,
            page
          })
        );

        commits.push(...data);

        if (data.length < 100) {
          break;
        }
        page++;
        
        if (page % 3 === 0) {
          console.log(`  📄 Fetched ${commits.length} commits (page ${page})...`);
        }
      }
      
      console.log(`  ✅ Found ${commits.length} commits`);
      return commits;
    });
  }

  async getRepositoryStats(owner, repo) {
    const cacheKey = this.cache.paginatedKey('repo-stats', owner, repo);
    
    return this.makeRequest(() => 
      this.octokit.repos.get({
        owner,
        repo
      }), cacheKey
    );
  }

  async listRepositories(owner, options = {}) {
    console.log(`🔍 Discovering repositories for ${owner}...`);
    
    const cacheKey = this.cache.paginatedKey('org-repos', owner, {
      type: 'all',
      filters: options
    });
    
    return this.cache.getOrSet(cacheKey, async () => {
      const repos = [];
      let page = 1;
      
      while (true) {
        const data = await this.makeRequest(() => 
          this.octokit.repos.listForOrg({
            org: owner,
            type: 'all',
            sort: 'updated',
            direction: 'desc',
            per_page: 100,
            page
          })
        );

        const filteredRepos = data.filter(repo => {
          if (options.excludeArchived && repo.archived) return false;
          if (options.excludeForks && repo.fork) return false;
          if (options.minSize && repo.size < options.minSize) return false;
          return true;
        });

        repos.push(...filteredRepos);

        if (data.length < 100) {
          break;
        }
        page++;
      }
      
      console.log(`  ✅ Discovered ${repos.length} repositories`);

      return repos.map(repo => ({
        name: repo.name,
        full_name: repo.full_name,
        updated_at: repo.updated_at,
        size: repo.size,
        archived: repo.archived,
        fork: repo.fork,
        language: repo.language,
        stargazers_count: repo.stargazers_count
      }));
    });
  }

  async getRecentActivity(owner, repo, days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    try {
      const commits = await this.getCommits(owner, repo, since, new Date());
      return {
        recentCommits: commits.length,
        lastCommitDate: commits.length > 0 ? commits[0].commit.committer.date : null
      };
    } catch (error) {
      return {
        recentCommits: 0,
        lastCommitDate: null,
        error: error.message
      };
    }
  }
  
  // Get comprehensive statistics
  getStats() {
    const cacheStats = this.cache.getStats();
    const rateLimitStats = this.rateLimiter.getStats();
    
    return {
      requestsThisRun: this.requestsThisRun,
      cache: cacheStats,
      rateLimiting: rateLimitStats
    };
  }
  
  // Display statistics
  displayStats() {
    console.log(`
📈 GitHub API Usage Summary:`);
    console.log(`  Requests This Run: ${this.requestsThisRun}`);
    
    this.rateLimiter.displayStats();
    
    const cacheStats = this.cache.getStats();
    if (cacheStats.enabled) {
      console.log(`
🗄 Cache Statistics:`);
      console.log(`  Valid Entries: ${cacheStats.entries}`);
      console.log(`  Total Size: ${cacheStats.sizeFormatted}`);
    }
  }
  
  // Clean up resources
  cleanup() {
    this.cache.cleanup();
  }
}

module.exports = GitHubClient;