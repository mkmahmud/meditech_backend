import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      db: this.configService.get<number>('REDIS_DB', 0),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Redis connected successfully');
    });

    this.client.on('error', (error) => {
      this.logger.error('❌ Redis connection error', error);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  /**
   * Get value from Redis
   * @param key - Cache key
   * @returns Cached value or null
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Redis GET error for key: ${key}`, error);
      return null;
    }
  }

  /**
   * Set value in Redis
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional)
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Redis SET error for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete key from Redis
   * @param key - Cache key
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Redis DELETE error for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete multiple keys matching pattern
   * @param pattern - Key pattern (e.g., 'user:*')
   */
  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Redis DELETE BY PATTERN error: ${pattern}`, error);
      throw error;
    }
  }

  /**
   * Check if key exists
   * @param key - Cache key
   * @returns boolean
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS error for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Set expiration time for key
   * @param key - Cache key
   * @param seconds - Seconds until expiration
   */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      this.logger.error(`Redis EXPIRE error for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Get remaining TTL for key
   * @param key - Cache key
   * @returns Remaining seconds or -1 if no expiration
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Redis TTL error for key: ${key}`, error);
      return -1;
    }
  }

  /**
   * Increment value (useful for counters, rate limiting)
   * @param key - Cache key
   * @param amount - Amount to increment (default: 1)
   * @returns New value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.client.incrby(key, amount);
    } catch (error) {
      this.logger.error(`Redis INCREMENT error for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Decrement value
   * @param key - Cache key
   * @param amount - Amount to decrement (default: 1)
   * @returns New value
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.client.decrby(key, amount);
    } catch (error) {
      this.logger.error(`Redis DECREMENT error for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Add item to set
   * @param key - Set key
   * @param members - Members to add
   */
  async addToSet(key: string, ...members: string[]): Promise<void> {
    try {
      await this.client.sadd(key, ...members);
    } catch (error) {
      this.logger.error(`Redis SADD error for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Remove item from set
   * @param key - Set key
   * @param members - Members to remove
   */
  async removeFromSet(key: string, ...members: string[]): Promise<void> {
    try {
      await this.client.srem(key, ...members);
    } catch (error) {
      this.logger.error(`Redis SREM error for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Check if member exists in set
   * @param key - Set key
   * @param member - Member to check
   * @returns boolean
   */
  async isInSet(key: string, member: string): Promise<boolean> {
    try {
      const result = await this.client.sismember(key, member);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis SISMEMBER error for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Get all members of a set
   * @param key - Set key
   * @returns Array of members
   */
  async getSetMembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      this.logger.error(`Redis SMEMBERS error for key: ${key}`, error);
      return [];
    }
  }

  /**
   * Flush all keys (use with caution!)
   */
  async flushAll(): Promise<void> {
    try {
      await this.client.flushall();
      this.logger.warn('⚠️  Redis cache flushed');
    } catch (error) {
      this.logger.error('Redis FLUSHALL error', error);
      throw error;
    }
  }

  /**
   * Get Redis client for advanced operations
   * @returns Redis client instance
   */
  getClient(): Redis {
    return this.client;
  }
}
