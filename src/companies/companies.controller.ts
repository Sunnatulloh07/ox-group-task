import { Controller, Post, Delete, Get, Body, Param, UseGuards, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyAdminGuard } from '../auth/guards/company-admin.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('Companies')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get('companies')
  @ApiOperation({ 
    summary: 'Get user companies',
    description: 'Get list of companies associated with the current user'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User companies retrieved successfully',
    schema: {
      example: {
        success: true,
        companies: [
          {
            id: 27,
            subdomain: 'demo',
            role: 'ADMIN',
            createdAt: '2025-07-06T17:30:00.000Z'
          }
        ]
      }
    }
  })
  getUserCompanies(@GetUser('sub') userId: number) {
    return this.companiesService.getUserCompanies(userId);
  }

  @Post('register-company')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Register company with OX API',
    description: 'Register a new company or join existing company using OX API token and subdomain'
  })
  @ApiBody({ type: RegisterCompanyDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Company registered successfully',
    schema: {
      example: {
        message: 'Company registered successfully and user set as admin',
        company: {
          id: 1,
          subdomain: 'demo'
        },
        role: 'ADMIN'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid token or subdomain' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  registerCompany(
    @Body() dto: RegisterCompanyDto,
    @GetUser('sub') userId: number,
  ) {
    return this.companiesService.registerCompany(dto, userId);
  }

  @Delete('company/:id')
  @UseGuards(CompanyAdminGuard)
  @ApiOperation({ 
    summary: 'Delete company (Admin only)',
    description: 'Delete a company. Only the admin who created the company can delete it.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'Company ID to delete',
    type: 'integer'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Company deleted successfully',
    schema: {
      example: {
        message: 'Company deleted successfully',
        deletedCompany: {
          id: 1,
          subdomain: 'demo'
        }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Only company admin can delete' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  deleteCompany(
    @Param('id', ParseIntPipe) companyId: number,
    @GetUser('sub') userId: number,
  ) {
    return this.companiesService.deleteCompany(companyId, userId);
  }
}