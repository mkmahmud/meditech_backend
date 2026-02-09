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

  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, method, url, ip, headers } = request;

    // Map HTTP methods to audit actions
    const actionMap: Record<string, AuditAction> = {
      GET: AuditAction.READ,
      POST: AuditAction.CREATE,
      PUT: AuditAction.UPDATE,
      PATCH: AuditAction.UPDATE,
      DELETE: AuditAction.DELETE,
    };

    const action = actionMap[method] || AuditAction.READ;

    // Extract resource from URL
    const pathParts = url.split('/').filter(Boolean);
    const resource = pathParts[2] || 'Unknown'; // Skip 'api/v1'

    return next.handle().pipe(
      tap(() => {
        // Log successful operation
        if (user) {
          this.auditService
            .createAuditLog({
              userId: user.id,
              action,
              resource,
              ipAddress: ip,
              userAgent: headers['user-agent'],
              endpoint: url,
              method,
              success: true,
            })
            .catch((error) => {
              this.logger.error('Failed to create audit log', error);
            });
        }
      }),
      catchError((error) => {
        // Log failed operation
        if (user) {
          this.auditService
            .createAuditLog({
              userId: user.id,
              action,
              resource,
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
        }
        throw error;
      }),
    );
  }
}
