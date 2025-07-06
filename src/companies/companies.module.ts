import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { CompanyAdminGuard } from '../auth/guards/company-admin.guard';

@Module({
  imports: [ConfigModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyAdminGuard],
})
export class CompaniesModule {}
