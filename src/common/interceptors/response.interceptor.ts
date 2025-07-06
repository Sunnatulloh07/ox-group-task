import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { map } from 'rxjs/operators';
  
  export interface Response<T> {
    success: boolean;
    statusCode: number;
    message: string;
    data: T;
    timestamp: string;
  }
  
  @Injectable()
  export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
      const ctx = context.switchToHttp();
      const response = ctx.getResponse();
  
      return next.handle().pipe(
        map((data) => {
          // If the service returns an object with message, use it
          if (data && typeof data === 'object' && 'message' in data) {
            return {
              success: true,
              statusCode: response.statusCode,
              message: data.message,
              data: data,
              timestamp: new Date().toISOString(),
            };
          }
          
          // Otherwise use default message
          return {
            success: true,
            statusCode: response.statusCode,
            message: 'Request successful',
            data,
            timestamp: new Date().toISOString(),
          };
        }),
      );
    }
  }
  