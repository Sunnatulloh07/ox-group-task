import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetProductsDto } from './dto/get-products.dto';
import axios, { AxiosError } from 'axios';
import { Role } from '@prisma/client';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private prisma: PrismaService) {}

  async getProducts(dto: GetProductsDto, userId: number, userCompanies: any[]) {
    if (!userCompanies || userCompanies.length === 0) {
      throw new BadRequestException('User has no associated companies');
    }

    const hasManagerRole = userCompanies.some(company => 
      company.role === Role.MANAGER || company.role === Role.ADMIN
    );

    if (!hasManagerRole) {
      throw new ForbiddenException('Only users with manager or admin role can access products');
    }

    let selectedCompany;

    if (dto.companyId) {
      selectedCompany = userCompanies.find(company => company.id === dto.companyId);
      if (!selectedCompany) {
        throw new BadRequestException('You do not have access to the specified company');
      }
    } else {
      selectedCompany = userCompanies.find(company => 
        company.role === Role.MANAGER || company.role === Role.ADMIN
      );
      
      if (!selectedCompany) {
        throw new BadRequestException('No accessible company found');
      }
    }

    try {
      const response = await axios.get(
        `https://${selectedCompany.subdomain}.ox-sys.com/variations`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${selectedCompany.token}`,
          },
          params: {
            page: dto.page,
            size: dto.size,
          },
          timeout: 15000,
        }
      );

    
      return {
        success: true,
        data: response.data,
        pagination: {
          page: dto.page,
          size: dto.size,
          total: response.data?.total || 0,
        },
        company: {
          id: selectedCompany.id,
          subdomain: selectedCompany.subdomain,
          userRole: selectedCompany.role,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch products from OX API: ${error.message}`);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new ForbiddenException('Invalid or expired company token. Please re-register the company.');
        } else if (error.response?.status === 403) {
          throw new ForbiddenException('Access denied to company products');
        } else if (error.response?.status === 404) {
          throw new BadRequestException('Products endpoint not found for this company');
        } else if (error.code === 'ECONNABORTED') {
          throw new BadRequestException('Request timeout while fetching products');
        } else if (error.response?.status >= 500) {
          throw new BadRequestException('OX API server error. Please try again later.');
        }
      }
      
      throw new BadRequestException('Failed to fetch products from OX API');
    }
  }

  async getUserCompanies(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userCompanies: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user.userCompanies.map(uc => ({
      id: uc.company.id,
      subdomain: uc.company.subdomain,
      role: uc.role,
      token: uc.company.token,
    }));
  }
}
