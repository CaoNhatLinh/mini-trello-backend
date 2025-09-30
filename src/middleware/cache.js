const crypto = require('crypto');


class CacheManager {
  constructor(options = {}) {
    this.cache = new Map();
    this.defaultDuration = options.duration || 30 * 1000; // 30 seconds
    this.maxSize = options.maxSize || 1000; // Maximum cache entries
  }


  generateETag(data) {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return `"${crypto.createHash('md5').update(content).digest('hex')}"`;
  }

  isCacheValid(cached) {
    return cached && Date.now() - cached.timestamp < this.defaultDuration;
  }

  handleConditionalRequest(req, cached) {
    const clientETag = req.headers['if-none-match'];
    if (clientETag && clientETag === cached.etag) {
      return { shouldReturn304: true, reason: 'ETag match' };
    }
    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince && cached.lastModified) {
      const clientTime = new Date(ifModifiedSince);
      const resourceTime = new Date(cached.lastModified);
      if (clientTime >= resourceTime) {
        return { shouldReturn304: true, reason: 'Not modified since' };
      }
    }

    return { shouldReturn304: false };
  }

  setCacheHeaders(res, etag, lastModified, maxAge = 30) {
    const headers = {
      'Cache-Control': `public, max-age=${maxAge}`,
    };

    if (etag) {
      headers['ETag'] = etag;
    }

    if (lastModified) {
      headers['Last-Modified'] = lastModified;
    }

    res.set(headers);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.defaultDuration) {
        this.cache.delete(key);
      }
    }
  }

  middleware(options = {}) {
    const duration = options.duration || this.defaultDuration;
    const maxAge = Math.floor(duration / 1000);

    return (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }
      // Generate cache key
      const key = req.originalUrl + (req.user?.uid || '');
      const cached = this.cache.get(key);

      if (this.isCacheValid(cached)) {
        console.log(`Cache hit for ${key}`);

        const conditionalResult = this.handleConditionalRequest(req, cached);
        if (conditionalResult.shouldReturn304) {
          console.log(`Returning 304 Not Modified for ${key} (${conditionalResult.reason})`);
          this.setCacheHeaders(res, cached.etag, cached.lastModified, maxAge);
          return res.status(304).end();
        }
        this.setCacheHeaders(res, cached.etag, cached.lastModified, maxAge);
        return res.json(cached.data);
      }
      const originalJson = res.json;
      const self = this;

      res.json = function(data) {
        if (res.statusCode === 200) {
          const etag = self.generateETag(data);
          const lastModified = new Date().toUTCString();
          self.setCacheHeaders(res, etag, lastModified, maxAge);
          if (self.cache.size >= self.maxSize) {
            const firstKey = self.cache.keys().next().value;
            self.cache.delete(firstKey);
          }
          self.cache.set(key, {
            data,
            etag,
            lastModified,
            timestamp: Date.now()
          });

          console.log(`Cached response for ${key} with ETag: ${etag}`);
        }

        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      duration: this.defaultDuration
    };
  }
}

// Create singleton instance
const cacheManager = new CacheManager({
  duration: 30 * 1000, // 30 seconds
  maxSize: 1000
});

setInterval(() => {
  cacheManager.cleanup();
}, 60 * 1000);

module.exports = {
  CacheManager,
  cacheManager
};