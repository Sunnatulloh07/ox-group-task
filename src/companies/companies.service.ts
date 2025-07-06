import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { Role } from '@/prisma/generated/client';
import axios, { AxiosError } from 'axios';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(private prisma: PrismaService) {}

  async registerCompany(dto: RegisterCompanyDto, userId: number) {
    // Token'dan Bearer qismini olib tashlash
    const cleanToken = dto.token.replace(/^Bearer\s+/, '').trim();
    
    if (!cleanToken) {
      throw new BadRequestException('Invalid token format');
    }

    // OX API orqali tokenni validatsiya qilish
    try {
      this.logger.log(`Validating token for subdomain: ${dto.subdomain}`);
      
      const response = await axios.get(
        `https://${dto.subdomain}.ox-sys.com/profile`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${cleanToken}`,
          },
          timeout: 10000, // 10 soniya timeout
        }
      );

      this.logger.log(`OX API validation successful for ${dto.subdomain}`);
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
      throw new BadRequestException('Failed to validate token with OX API');
    }

    // Kompaniya mavjudligini tekshirish
    const existingCompany = await this.prisma.company.findUnique({
      where: { subdomain: dto.subdomain },
    });

    if (existingCompany) {
      // Mavjud kompaniyaga manager sifatida qo'shish
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
      // Yangi kompaniya yaratish
      const newCompany = await this.prisma.company.create({
        data: {
          subdomain: dto.subdomain,
          token: cleanToken,
          adminId: userId,
        },
      });

      // User'ni bu kompaniyaning admin'i qilish
      await this.prisma.userCompany.create({
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
    }
  }

  async deleteCompany(companyId: number, userId: number) {
    // Kompaniyani topish
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        userCompanies: true,
      },
    });

    if (!company) {
      throw new BadRequestException('Company not found');
    }

    // Faqat admin va kompaniyani yaratgan kishi o'chira olishi
    if (company.adminId !== userId) {
      throw new ForbiddenException('Only the admin who created this company can delete it');
    }

    try {
      // Kompaniyani o'chirish (Cascade bilan user_companies ham o'chiriladi)
      await this.prisma.company.delete({
        where: { id: companyId },
      });

      this.logger.log(`Company ${companyId} deleted by user ${userId}`);

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
}
