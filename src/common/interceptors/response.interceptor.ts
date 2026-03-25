import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Global response interceptor to standardize API responses
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            map((data) => {
                // If the data already has a message, use it; otherwise, provide a default message
                let message = 'Request successful';
                let responseData = data;
                if (data && typeof data === 'object' && 'message' in data) {
                    message = data.message;
                    // Remove message from data if present
                    const { message: _msg, ...rest } = data;
                    responseData = rest;
                }
                return {
                    success: true,
                    message,
                    data: responseData,
                };
            })
        );
    }
}
