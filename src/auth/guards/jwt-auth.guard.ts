import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
  } from '@nestjs/common';
  import { JwtService } from '@nestjs/jwt';
  import { PrismaService } from '../../prisma/prisma.service';
  import { Request } from 'express';
  
  @Injectable()
  export class JwtAuthGuard implements CanActivate {
    constructor(
      private jwtService: JwtService,
      private prisma: PrismaService,
    ) {}
  
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromHeader(request);
      
      if (!token) {
        throw new UnauthorizedException('Access token not found');
      }
  
      try {
        const payload = await this.jwtService.verifyAsync(token);
        
        // Database'dan user ma'lumotlarini olish (fresh data)
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          include: {
            userCompanies: {
              include: {
                company: true,
              },
            },
          },
        });
  
        if (!user) {
          throw new UnauthorizedException('User not found');
        }
  
        // Request'ga user ma'lumotlarini qo'shish
        request.user = {
          ...payload,
          companies: user.userCompanies.map(uc => ({
            id: uc.company.id,
            subdomain: uc.company.subdomain,
            role: uc.role,
            token: uc.company.token,
          })),
        };
      } catch (error) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      
      return true;
    }
  
    private extractTokenFromHeader(request: Request): string | undefined {
      const [type, token] = request.headers.authorization?.split(' ') ?? [];
      return type === 'Bearer' ? token : undefined;
    }
  }
  