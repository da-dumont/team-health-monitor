class RateLimiter {
  constructor(options = {}) {
    this.requestsPerHour = options.requestsPerHour || 4500; // Conservative limit
    this.burstLimit = options.burstLimit || 100; // Max requests per minute
    this.backoffMultiplier = options.backoffMultiplier || 1.5;
    this.maxBackoffMs = options.maxBackoffMs || 60000; // 1 minute max
    
    this.requests = [];
    this.burstRequests = [];
    this.currentBackoffMs = 1000; // Start with 1 second
    this.isRateLimited = false;
    this.rateLimitResetTime = null;
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      cachedRequests: 0,
      rateLimitHits: 0,
      backoffEvents: 0,
      totalWaitTime: 0
    };
  }

  now() {
    return Date.now();
  }

  cleanOldRequests() {
    const oneHourAgo = this.now() - (60 * 60 * 1000);
    const oneMinuteAgo = this.now() - (60 * 1000);
    
    this.requests = this.requests.filter(time => time > oneHourAgo);
    this.burstRequests = this.burstRequests.filter(time => time > oneMinuteAgo);
  }

  getRemainingRequests() {
    this.cleanOldRequests();
    return {
      hourly: Math.max(0, this.requestsPerHour - this.requests.length),
      burst: Math.max(0, this.burstLimit - this.burstRequests.length)
    };
  }

  getWaitTime() {
    this.cleanOldRequests();
    
    // If we're explicitly rate limited, wait until reset
    if (this.isRateLimited && this.rateLimitResetTime) {
      const waitTime = Math.max(0, this.rateLimitResetTime - this.now());
      if (waitTime > 0) {
        return waitTime;
      } else {
        // Reset time has passed
        this.isRateLimited = false;
        this.rateLimitResetTime = null;
        this.currentBackoffMs = 1000; // Reset backoff
      }
    }

    const remaining = this.getRemainingRequests();
    
    // Check burst limit
    if (remaining.burst <= 0) {
      const oldestBurstRequest = Math.min(...this.burstRequests);
      return Math.max(0, (oldestBurstRequest + 60000) - this.now());
    }
    
    // Check hourly limit
    if (remaining.hourly <= 10) { // Conservative threshold
      const oldestRequest = Math.min(...this.requests);
      const waitTime = Math.max(0, (oldestRequest + 3600000) - this.now());
      
      if (waitTime > 0) {
        return Math.min(waitTime, this.currentBackoffMs);
      }
    }
    
    return 0;
  }

  async waitIfNeeded() {
    const waitTime = this.getWaitTime();
    
    if (waitTime > 0) {
      this.stats.backoffEvents++;
      this.stats.totalWaitTime += waitTime;
      
      const seconds = Math.ceil(waitTime / 1000);
      console.log(`⏳ Rate limit approaching, waiting ${seconds}s...`);
      
      await this.sleep(waitTime);
      
      // Increase backoff for next time
      this.currentBackoffMs = Math.min(
        this.currentBackoffMs * this.backoffMultiplier,
        this.maxBackoffMs
      );
    } else {
      // Reset backoff on successful request
      this.currentBackoffMs = 1000;
    }
  }

  recordRequest(fromCache = false) {
    const now = this.now();
    
    if (fromCache) {
      this.stats.cachedRequests++;
    } else {
      this.requests.push(now);
      this.burstRequests.push(now);
      this.stats.totalRequests++;
    }
  }

  handleRateLimitResponse(rateLimitReset) {
    this.isRateLimited = true;
    this.rateLimitResetTime = rateLimitReset * 1000; // Convert to milliseconds
    this.stats.rateLimitHits++;
    
    const waitTime = this.rateLimitResetTime - this.now();
    const minutes = Math.ceil(waitTime / 60000);
    console.warn(`🚫 Rate limited! Waiting ${minutes} minutes until reset...`);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const remaining = this.getRemainingRequests();
    
    return {
      ...this.stats,
      remaining,
      isRateLimited: this.isRateLimited,
      nextResetIn: this.rateLimitResetTime ? 
        Math.max(0, this.rateLimitResetTime - this.now()) : 0,
      efficiency: this.stats.totalRequests > 0 ? 
        (this.stats.cachedRequests / (this.stats.totalRequests + this.stats.cachedRequests)) * 100 : 0
    };
  }

  displayStats() {
    const stats = this.getStats();
    console.log('\n📊 API Usage Statistics:');
    console.log(`  Total API Requests: ${stats.totalRequests}`);
    console.log(`  Cached Responses: ${stats.cachedRequests}`);
    console.log(`  Cache Efficiency: ${stats.efficiency.toFixed(1)}%`);
    console.log(`  Rate Limit Hits: ${stats.rateLimitHits}`);
    console.log(`  Backoff Events: ${stats.backoffEvents}`);
    console.log(`  Total Wait Time: ${Math.ceil(stats.totalWaitTime / 1000)}s`);
    console.log(`  Remaining (Hour): ${stats.remaining.hourly}`);
    console.log(`  Remaining (Burst): ${stats.remaining.burst}`);
  }
}

module.exports = RateLimiter;