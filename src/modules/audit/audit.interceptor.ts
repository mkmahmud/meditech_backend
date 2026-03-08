import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private auditService: AuditService) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, method, url, ip, headers } = request;
    const params = request.params || {};
    const body = request.body || {};
    const query = request.query || {};

    if (!url || url.includes('/api/docs')) {
      return next.handle();
    }

    // Map HTTP methods to audit actions
    const actionMap: Record<string, AuditAction> = {
      GET: AuditAction.READ,
      POST: AuditAction.CREATE,
      PUT: AuditAction.UPDATE,
      PATCH: AuditAction.UPDATE,
      DELETE: AuditAction.DELETE,
    };

    const action = actionMap[method] || AuditAction.READ;

    // Extract resource from URL safely (handles both /api/v1/... and /...)
    const pathParts = url.split('?')[0].split('/').filter(Boolean);
    const resource = pathParts[0] === 'api' && pathParts[1]?.startsWith('v')
      ? pathParts[2] || 'unknown'
      : pathParts[0] || 'unknown';

    const resourceId =
      params.id ||
      params.userId ||
      params.patientId ||
      params.appointmentId ||
      body.id ||
      body.userId ||
      body.patientId ||
      body.appointmentId ||
      query.id ||
      query.userId ||
      query.patientId ||
      query.appointmentId;

    const patientId =
      params.patientId || body.patientId || query.patientId || undefined;

    const phiResources = [
      'patients',
      'appointments',
      'prescriptions',
      'lab-results',
      'insurance',
      'payments',
      'notifications',
    ];

    const phiAccessed = phiResources.includes(resource);

    return next.handle().pipe(
      tap(() => {
        this.auditService
          .createAuditLog({
            userId: user?.id,
            action,
            resource,
            resourceId: resourceId ? String(resourceId) : undefined,
            phiAccessed,
            patientId: patientId ? String(patientId) : undefined,
            ipAddress: ip,
            userAgent: headers['user-agent'],
            endpoint: url,
            method,
            success: true,
          })
          .catch((error) => {
            this.logger.error('Failed to create audit log', error);
          });
      }),
      catchError((error) => {
        this.auditService
          .createAuditLog({
            userId: user?.id,
            action,
            resource,
            resourceId: resourceId ? String(resourceId) : undefined,
            phiAccessed,
            patientId: patientId ? String(patientId) : undefined,
            ipAddress: ip,
            userAgent: headers['user-agent'],
            endpoint: url,
            method,
            success: false,
            errorMessage: error.message,
          })
          .catch((auditError) => {
            this.logger.error('Failed to create audit log', auditError);
          });
        throw error;
      }),
    );
  }
}
