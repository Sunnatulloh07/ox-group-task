import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { Role } from '@prisma/client';
import axios, { AxiosError } from 'axios';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async validateOxToken(subdomain: string): Promise<boolean> {
    try {
      
      const oxToken = this.configService.get<string>('OX_API_TOKEN');
      if (!oxToken) {
        throw new BadRequestException('OX API token not configured');
      }

      const cleanToken = oxToken.replace(/^Bearer\s+/, '').trim();
      
      const response = await axios.get(
        `https://${subdomain}.ox-sys.com/profile`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${cleanToken}`,
          },
          timeout: 10000,
        }
      );

      return true;
    } catch (error) {
      this.logger.error(`OX API validation failed: ${error.message}`);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new BadRequestException('Invalid or expired OX API token');
        } else if (error.response?.status === 404) {
          throw new BadRequestException('Subdomain not found or invalid');
        } else if (error.code === 'ECONNABORTED') {
          throw new BadRequestException('OX API request timeout');
        }
      }
      throw new BadRequestException('Failed to validate with OX API');
    }
  }

  async registerCompany(dto: RegisterCompanyDto, userId: number) {
    const oxToken = this.configService.get<string>('OX_API_TOKEN');
    if (!oxToken) {
      throw new BadRequestException('OX API token not configured');
    }

    const cleanToken = oxToken.replace(/^Bearer\s+/, '').trim();

    await this.validateOxToken(dto.subdomain);

    const existingCompany = await this.prisma.company.findUnique({
      where: { subdomain: dto.subdomain },
    });

    if (existingCompany) {
      const existingUserCompany = await this.prisma.userCompany.findUnique({
        where: {
          userId_companyId: {
            userId,
            companyId: existingCompany.id,
          },
        },
      });

      if (existingUserCompany) {
        throw new BadRequestException('User already associated with this company');
      }

      await this.prisma.userCompany.create({
        data: {
          userId,
          companyId: existingCompany.id,
          role: Role.MANAGER,
        },
      });

      return {
        message: 'Successfully joined existing company as manager',
        company: {
          id: existingCompany.id,
          subdomain: existingCompany.subdomain,
        },
        role: Role.MANAGER,
      };
    } else {
      return await this.prisma.$transaction(async (tx) => {
        const newCompany = await tx.company.create({
          data: {
            subdomain: dto.subdomain,
            token: cleanToken,
            adminId: userId,
          },
        });

        await tx.userCompany.create({
          data: {
            userId,
            companyId: newCompany.id,
            role: Role.ADMIN,
          },
        });

        return {
          message: 'Company registered successfully and user set as admin',
          company: {
            id: newCompany.id,
            subdomain: newCompany.subdomain,
          },
          role: Role.ADMIN,
        };
      });
    }
  }

  async deleteCompany(companyId: number, userId: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        userCompanies: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (!company.adminId || company.adminId !== userId) {
      throw new ForbiddenException('Only the admin who created this company can delete it');
    }

    try {
      await this.prisma.company.delete({
        where: { id: companyId },
      });


      return {
        message: 'Company deleted successfully',
        deletedCompany: {
          id: company.id,
          subdomain: company.subdomain,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to delete company ${companyId}: ${error.message}`);
      throw new BadRequestException('Failed to delete company');
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

    const companies = user.userCompanies.map(uc => ({
      id: uc.company.id,
      subdomain: uc.company.subdomain,
      role: uc.role,
      createdAt: uc.company.createdAt,
    }));

    return {
      success: true,
      companies,
    };
  }
}
