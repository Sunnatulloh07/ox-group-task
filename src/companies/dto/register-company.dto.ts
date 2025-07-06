import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterCompanyDto {
  @ApiProperty({ 
    example: 'demo',
    description: 'Company subdomain for OX API' 
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-]+$/, { message: 'Subdomain can only contain letters, numbers, and hyphens' })
  subdomain: string;
}
