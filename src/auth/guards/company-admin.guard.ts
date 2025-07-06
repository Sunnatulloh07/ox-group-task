import { Role } from '@prisma/client';
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompanyAdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = request;
    const companyId = parseInt(request.params.id);

    if (!user || !user.sub) {
      throw new ForbiddenException('User not authenticated');
    }
    
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (company.adminId !== user.sub) {
      throw new ForbiddenException('Only the admin who created this company can perform this action');
    }

    return true;
  }
}