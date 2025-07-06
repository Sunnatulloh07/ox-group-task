import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    Logger,
  } from '@nestjs/common';
  import { Request, Response } from 'express';
  
  @Catch(HttpException)
  export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);
  
    catch(exception: HttpException, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
  
      this.logger.error(
        `HTTP Exception: ${request.method} ${request.url} - ${status} - ${exception.message}`,
      );
  
      const errorResponse = {
        success: false,
        statusCode: status,
        message: typeof exceptionResponse === 'string' 
          ? exceptionResponse 
          : (exceptionResponse as any)?.message || 'Internal server error',
        error: typeof exceptionResponse === 'object' ? exceptionResponse : null,
        timestamp: new Date().toISOString(),
        path: request.url,
      };
  
      response.status(status).json(errorResponse);
    }
  }