const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CacheManager {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || path.join(process.cwd(), '.cache');
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24 hours default
    this.enabled = options.enabled !== false;
    
    if (this.enabled) {
      this.ensureCacheDir();
    }
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  generateKey(data) {
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  getCachePath(key) {
    return path.join(this.cacheDir, `${key}.json`);
  }

  isExpired(timestamp) {
    return Date.now() - timestamp > this.maxAge;
  }

  async get(key) {
    if (!this.enabled) return null;
    
    try {
      const cachePath = this.getCachePath(key);
      if (!fs.existsSync(cachePath)) return null;

      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      
      if (this.isExpired(cached.timestamp)) {
        fs.unlinkSync(cachePath);
        return null;
      }

      return cached.data;
    } catch (error) {
      // Cache corruption, ignore and continue
      return null;
    }
  }

  async set(key, data) {
    if (!this.enabled) return;
    
    try {
      const cachePath = this.getCachePath(key);
      const cacheData = {
        timestamp: Date.now(),
        data
      };
      
      fs.writeFileSync(cachePath, JSON.stringify(cacheData));
    } catch (error) {
      // Cache write failed, continue without caching
      console.warn(`⚠️  Cache write failed: ${error.message}`);
    }
  }

  async getOrSet(key, fetchFunction) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetchFunction();
    await this.set(key, data);
    return data;
  }

  // Generate cache key for PR details (most expensive operation)
  prDetailsKey(owner, repo, prNumber, prUpdatedAt) {
    return this.generateKey({
      type: 'pr-details',
      owner,
      repo,
      prNumber,
      // Include updated_at to invalidate cache if PR was modified
      prUpdatedAt: prUpdatedAt
    });
  }

  // Generate cache key for paginated results
  paginatedKey(type, owner, repo, params = {}) {
    return this.generateKey({
      type,
      owner,
      repo,
      ...params
    });
  }

  // Clear expired cache entries
  cleanup() {
    if (!this.enabled || !fs.existsSync(this.cacheDir)) return;
    
    try {
      const files = fs.readdirSync(this.cacheDir);
      let cleaned = 0;
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(this.cacheDir, file);
        try {
          const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (this.isExpired(cached.timestamp)) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        } catch {
          // Corrupted file, delete it
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
      }
    } catch (error) {
      console.warn(`⚠️  Cache cleanup failed: ${error.message}`);
    }
  }

  // Get cache statistics
  getStats() {
    if (!this.enabled || !fs.existsSync(this.cacheDir)) {
      return { enabled: false, entries: 0, size: 0 };
    }

    try {
      const files = fs.readdirSync(this.cacheDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      let totalSize = 0;
      let validEntries = 0;
      
      for (const file of jsonFiles) {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
        
        try {
          const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (!this.isExpired(cached.timestamp)) {
            validEntries++;
          }
        } catch {
          // Corrupted file
        }
      }
      
      return {
        enabled: true,
        entries: validEntries,
        totalEntries: jsonFiles.length,
        size: totalSize,
        sizeFormatted: this.formatBytes(totalSize)
      };
    } catch (error) {
      return { enabled: true, entries: 0, size: 0, error: error.message };
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = CacheManager;