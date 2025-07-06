import { Role } from '@/prisma/generated/client';
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class CompanyAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user } = request;
    const companyId = parseInt(request.params.id);

    if (!user || !user.companies) {
      throw new ForbiddenException('User not authenticated');
    }

    // Faqat shu kompaniyaning admin'i o'chira olishi
    const isCompanyAdmin = user.companies.some((company: any) => 
      company.id === companyId && company.role === Role.ADMIN
    );

    if (!isCompanyAdmin) {
      throw new ForbiddenException('Only company admin can perform this action');
    }

    return true;
  }
}