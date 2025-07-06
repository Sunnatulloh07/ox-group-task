import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { GetProductsDto } from './dto/get-products.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ManagerOnly } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @ManagerOnly()
  @ApiOperation({ 
    summary: 'Get products from OX API',
    description: 'Fetch products from OX API with pagination. Only users with manager or admin role can access this endpoint.'
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    description: 'Page number (default: 1)',
    example: 1
  })
  @ApiQuery({ 
    name: 'size', 
    required: false, 
    description: 'Items per page (max 20, default: 10)',
    example: 10
  })
  @ApiQuery({ 
    name: 'companyId', 
    required: false, 
    description: 'Specific company ID (optional)',
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Products retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          variations: [],
          total: 0
        },
        pagination: {
          page: 1,
          size: 10,
          total: 0
        },
        company: {
          id: 1,
          subdomain: 'demo',
          userRole: 'MANAGER'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid parameters or size > 20' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions or invalid company token' })
  async getProducts(
    @Query() dto: GetProductsDto,
    @GetUser('sub') userId: number,
  ) {
    const userCompanies = await this.productsService.getUserCompanies(userId);
    return this.productsService.getProducts(dto, userId, userCompanies);
  }
}