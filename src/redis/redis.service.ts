import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.client = new Redis(url);
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  /** Store a value with a TTL (seconds). */
  async setWithTtl(key: string, value: string, ttlSeconds: number) {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string) {
    await this.client.del(key);
  }
}
