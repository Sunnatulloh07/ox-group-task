import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetProductsDto {
  @ApiPropertyOptional({ 
    example: 1,
    description: 'Page number (minimum 1)',
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({ 
    example: 10,
    description: 'Number of items per page (maximum 20)',
    minimum: 1,
    maximum: 20,
    default: 10
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Size must be an integer' })
  @Min(1, { message: 'Size must be at least 1' })
  @Max(20, { message: 'Size cannot be greater than 20' })
  size?: number = 10;

  @ApiPropertyOptional({ 
    example: 1,
    description: 'Company ID to get products from (optional, uses first company if not specified)',
    minimum: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Company ID must be an integer' })
  @Min(1, { message: 'Company ID must be at least 1' })
  companyId?: number;
}