import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'], // Minimal logging in production to save execution time
    });
  }

  async onModuleInit() {
    try {
      // In serverless, we want to connect as late as possible 
      // or rely on Prisma's lazy connection, but a ping ensures the DB is up.
      await this.$connect();
      this.logger.log('✅ Database connected');
    } catch (error) {
      this.logger.error('❌ Database connection failed', error);
      // Don't throw error here in serverless or the whole lambda fails to start
    }
  }

  // Helper method for soft deletes
  async softDelete(model: string, id: string) {
    return (this as any)[model].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Transaction helper
  async runTransaction<T>(
    callback: (prisma: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(callback);
  }
}