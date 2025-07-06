import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ProductsService } from '../../src/products/products.service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ProductsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let productsService: ProductsService;
  let userToken: string;
  let testUser: any;
  let testCompany: any;

  beforeAll(async () => {
    // JWT secret ni test environment uchun o'rnatish
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
    // OX API token ni test environment uchun o'rnatish
    process.env.OX_API_TOKEN = 'Bearer test-ox-api-token';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // API prefix qo'shish (main.ts dagi kabi)
    app.setGlobalPrefix('api', {
      exclude: ['/'],
    });

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    productsService = app.get<ProductsService>(ProductsService);
  });

  beforeEach(async () => {
    // Database'ni tozalash - FK constraint tartib muhim
    await prisma.userCompany.deleteMany();
    await prisma.company.deleteMany();
    await prisma.user.deleteMany();

    // Test user yaratish
    testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
      },
    });

    // Ensure user was created successfully
    expect(testUser).toBeTruthy();
    expect(testUser.id).toBeTruthy();

    // JWT token yaratish
    userToken = jwtService.sign({
      sub: testUser.id,
      email: testUser.email,
    });

    // Test kompaniya yaratish
    testCompany = await prisma.company.create({
      data: {
        subdomain: `test-company-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        token: 'test-token',
        adminId: testUser.id,
      },
    });

    // Ensure company was created successfully
    expect(testCompany).toBeTruthy();
    expect(testCompany.id).toBeTruthy();

    // UserCompany yaratish
    await prisma.userCompany.create({
      data: {
        userId: testUser.id,
        companyId: testCompany.id,
        role: Role.ADMIN,
      },
    });

    // Mock axios responses
    mockedAxios.get.mockResolvedValue({
      data: {
        variations: [
          {
            id: '123',
            name: 'Test Product',
            price: 100,
            description: 'Test Description',
          },
        ],
        total: 1,
      },
    });
  });

  describe('/api/products (GET)', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/api/products')
        .expect(401);
    });

    it('should require manager or admin role', async () => {
      // Regular user yaratish (role yo'q)
      const otherUser = await prisma.user.create({
        data: {
          email: `other-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        },
      });

      const otherUserToken = jwtService.sign({
        sub: otherUser.id,
        email: otherUser.email,
      });

      return request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403); // Insufficient permissions
    });

    it('should get products from OX API (without companyId)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ page: 1, size: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.data).toHaveProperty('variations');
      expect(Array.isArray(response.body.data.data.variations)).toBeTruthy();
      expect(response.body.data.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.size).toBe(10);
    });

    it('should get products from OX API (with companyId)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ page: 1, size: 10, companyId: testCompany.id })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.data).toHaveProperty('variations');
      expect(response.body.data.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.company.id).toBe(testCompany.id);
      expect(response.body.data.company.subdomain).toBe(testCompany.subdomain);
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ page: 2, size: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(2);
      expect(response.body.data.pagination.size).toBe(5);
    });

    it('should reject size > 20', async () => {
      return request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ page: 1, size: 25 })
        .expect(400);
    });

    it('should reject access to non-owned company', async () => {
      // Boshqa user'ning kompaniyasini yaratish
      const otherUser = await prisma.user.create({
        data: {
          email: `other-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        },
      });

      const otherCompany = await prisma.company.create({
        data: {
          subdomain: `other-company-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          token: 'other-token',
          adminId: otherUser.id,
        },
      });

      await prisma.userCompany.create({
        data: {
          userId: otherUser.id,
          companyId: otherCompany.id,
          role: Role.ADMIN,
        },
      });

      return request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ companyId: otherCompany.id })
        .expect(400);
    });

    it('should work with manager role', async () => {
      // Manager user yaratish
      const managerUser = await prisma.user.create({
        data: {
          email: `manager-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        },
      });

      await prisma.userCompany.create({
        data: {
          userId: managerUser.id,
          companyId: testCompany.id,
          role: Role.MANAGER,
        },
      });

      const managerToken = jwtService.sign({
        sub: managerUser.id,
        email: managerUser.email,
      });

      const response = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${managerToken}`)
        .query({ companyId: testCompany.id })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.company.userRole).toBe(Role.MANAGER);
    });

    it('should handle OX API errors', async () => {
      // Mock axios to throw error
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 401 },
      });

      return request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ companyId: testCompany.id })
        .expect(400);
    });
  });

  afterAll(async () => {
    await prisma.userCompany.deleteMany();
    await prisma.company.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });
}); 