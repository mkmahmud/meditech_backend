import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditAction } from '@prisma/client';

export interface AuditLogData {
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  phiAccessed?: boolean;
  patientId?: string;
  ipAddress: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  oldValues?: any;
  newValues?: any;
  success?: boolean;
  errorMessage?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create audit log entry
   * @param data - Audit log data
   */
  async createAuditLog(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          phiAccessed: data.phiAccessed || false,
          patientId: data.patientId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          endpoint: data.endpoint,
          method: data.method,
          oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
          newValues: data.newValues ? JSON.stringify(data.newValues) : null,
          success: data.success !== false,
          errorMessage: data.errorMessage,
        },
      });

      // Log critical PHI access
      if (data.phiAccessed) {
        this.logger.warn(
          `PHI ACCESSED: User ${data.userId} accessed patient ${data.patientId} data`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to create audit log', error);
      // Don't throw error to prevent blocking the main operation
    }
  }

  /**
   * Log user login
   */
  async logLogin(userId: string, ipAddress: string, success: boolean): Promise<void> {
    await this.createAuditLog({
      userId,
      action: AuditAction.LOGIN,
      resource: 'User',
      resourceId: userId,
      ipAddress,
      endpoint: '/auth/login',
      method: 'POST',
      success,
      userAgent: '',
    });
  }

  /**
   * Log user logout
   */
  async logLogout(userId: string, ipAddress: string): Promise<void> {
    await this.createAuditLog({
      userId,
      action: AuditAction.LOGOUT,
      resource: 'User',
      resourceId: userId,
      ipAddress,
      endpoint: '/auth/logout',
      method: 'POST',
      userAgent: '',
    });
  }

  /**
   * Log data access (READ)
   */
  async logDataAccess(
    userId: string,
    resource: string,
    resourceId: string,
    ipAddress: string,
    phiAccessed: boolean = false,
    patientId?: string,
  ): Promise<void> {
    await this.createAuditLog({
      userId,
      action: AuditAction.READ,
      resource,
      resourceId,
      phiAccessed,
      patientId,
      ipAddress,
      endpoint: '',
      method: 'GET',
      userAgent: '',
    });
  }

  /**
   * Log data creation (CREATE)
   */
  async logDataCreation(
    userId: string,
    resource: string,
    resourceId: string,
    ipAddress: string,
    newValues: any,
    phiAccessed: boolean = false,
    patientId?: string,
  ): Promise<void> {
    await this.createAuditLog({
      userId,
      action: AuditAction.CREATE,
      resource,
      resourceId,
      phiAccessed,
      patientId,
      ipAddress,
      endpoint: '',
      method: 'POST',
      newValues,
      userAgent: '',
    });
  }

  /**
   * Log data update (UPDATE)
   */
  async logDataUpdate(
    userId: string,
    resource: string,
    resourceId: string,
    ipAddress: string,
    oldValues: any,
    newValues: any,
    phiAccessed: boolean = false,
    patientId?: string,
  ): Promise<void> {
    await this.createAuditLog({
      userId,
      action: AuditAction.UPDATE,
      resource,
      resourceId,
      phiAccessed,
      patientId,
      ipAddress,
      endpoint: '',
      method: 'PUT',
      oldValues,
      newValues,
      userAgent: '',
    });
  }

  /**
   * Log data deletion (DELETE)
   */
  async logDataDeletion(
    userId: string,
    resource: string,
    resourceId: string,
    ipAddress: string,
    oldValues: any,
    phiAccessed: boolean = false,
    patientId?: string,
  ): Promise<void> {
    await this.createAuditLog({
      userId,
      action: AuditAction.DELETE,
      resource,
      resourceId,
      phiAccessed,
      patientId,
      ipAddress,
      endpoint: '',
      method: 'DELETE',
      oldValues,
      userAgent: '',
    });
  }

  /**
   * Get audit logs for a specific patient (for compliance)
   */
  async getPatientAuditLogs(patientId: string, limit: number = 100) {
    return this.prisma.auditLog.findMany({
      where: {
        patientId,
        phiAccessed: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditLogs(userId: string, limit: number = 100) {
    return this.prisma.auditLog.findMany({
      where: {
        userId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Get all PHI access logs (for compliance monitoring)
   */
  async getPHIAccessLogs(
    startDate?: Date,
    endDate?: Date,
    limit: number = 1000,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        phiAccessed: true,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Clean up old audit logs (retention policy)
   */
  async cleanupOldLogs(retentionDays: number = 2555): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Deleted ${result.count} old audit logs`);
  }
}
