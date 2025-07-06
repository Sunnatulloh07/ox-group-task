import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { CompaniesService } from '../../src/companies/companies.service';

describe('CompaniesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let companiesService: CompaniesService;
  let userToken: string;
  let testUser: any;

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
    companiesService = app.get<CompaniesService>(CompaniesService);

    // Mock validateOxToken method
    jest.spyOn(companiesService, 'validateOxToken').mockImplementation(async () => true);
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

    // JWT token yaratish
    userToken = jwtService.sign({
      sub: testUser.id,
      email: testUser.email,
    });
  });

  describe('/api/companies (GET)', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/api/companies')
        .expect(401);
    });

    it('should return empty array for user with no companies', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/companies')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.companies).toEqual([]);
    });

    it('should return user companies', async () => {
      // Kompaniya yaratish
      const company = await prisma.company.create({
        data: {
          subdomain: `test-company-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          token: 'test-token',
          adminId: testUser.id,
        },
      });

      // Ensure company was created successfully
      expect(company).toBeTruthy();
      expect(company.id).toBeTruthy();

      await prisma.userCompany.create({
        data: {
          userId: testUser.id,
          companyId: company.id,
          role: Role.ADMIN,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/companies')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.companies).toHaveLength(1);
      expect(response.body.data.companies[0]).toHaveProperty('id', company.id);
      expect(response.body.data.companies[0]).toHaveProperty('subdomain', company.subdomain);
      expect(response.body.data.companies[0]).toHaveProperty('role', Role.ADMIN);
    });
  });

  describe('/api/register-company (POST)', () => {
    it('should require authentication', () => {
      const registerDto = {
        subdomain: `test-company-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };

      return request(app.getHttpServer())
        .post('/api/register-company')
        .send(registerDto)
        .expect(401);
    });

    it('should validate subdomain format', () => {
      const registerDto = {
        subdomain: 'invalid-subdomain!@#',
      };

      return request(app.getHttpServer())
        .post('/api/register-company')
        .set('Authorization', `Bearer ${userToken}`)
        .send(registerDto)
        .expect(400);
    });

    it('should register new company and set user as admin', async () => {
      const registerDto = {
        subdomain: `test-company-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };

      const response = await request(app.getHttpServer())
        .post('/api/register-company')
        .set('Authorization', `Bearer ${userToken}`)
        .send(registerDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message', 'Company registered successfully and user set as admin');
      expect(response.body.data.company).toHaveProperty('subdomain', registerDto.subdomain);
      expect(response.body.data).toHaveProperty('role', Role.ADMIN);

      // Database'da tekshirish
      const company = await prisma.company.findFirst({
        where: { subdomain: registerDto.subdomain },
        include: {
          userCompanies: true,
        },
      });

      expect(company).toBeTruthy();
      expect(company.adminId).toBe(testUser.id);
      expect(company.userCompanies[0].role).toBe(Role.ADMIN);
    });

    it('should join existing company as manager', async () => {
      const registerDto = {
        subdomain: `test-company-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };

      // Avval kompaniya yaratish (boshqa user tomonidan)
      const adminUser = await prisma.user.create({
        data: {
          email: `admin-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        },
      });

      const existingCompany = await prisma.company.create({
        data: {
          subdomain: registerDto.subdomain,
          token: 'test-token',
          adminId: adminUser.id,
        },
      });

      // Admin user'ni kompaniyaga qo'shish
      await prisma.userCompany.create({
        data: {
          userId: adminUser.id,
          companyId: existingCompany.id,
          role: Role.ADMIN,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/register-company')
        .set('Authorization', `Bearer ${userToken}`)
        .send(registerDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message', 'Successfully joined existing company as manager');
      expect(response.body.data.company.id).toBe(existingCompany.id);
      expect(response.body.data).toHaveProperty('role', Role.MANAGER);

      // Database'da tekshirish
      const userCompany = await prisma.userCompany.findFirst({
        where: {
          userId: testUser.id,
          companyId: existingCompany.id,
        },
      });

      expect(userCompany).toBeTruthy();
      expect(userCompany.role).toBe(Role.MANAGER);
    });

    it('should prevent duplicate company registration', async () => {
      const registerDto = {
        subdomain: `test-company-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };

      // Avval kompaniya va userCompany yaratish
      const company = await prisma.company.create({
        data: {
          subdomain: registerDto.subdomain,
          token: 'test-token',
          adminId: testUser.id,
        },
      });

      await prisma.userCompany.create({
        data: {
          userId: testUser.id,
          companyId: company.id,
          role: Role.ADMIN,
        },
      });

      return request(app.getHttpServer())
        .post('/api/register-company')
        .set('Authorization', `Bearer ${userToken}`)
        .send(registerDto)
        .expect(400);
    });
  });

  describe('/api/company/:id (DELETE)', () => {
    let testCompany: any;

    beforeEach(async () => {
      // Test kompaniya yaratish
      testCompany = await prisma.company.create({
        data: {
          subdomain: `test-company-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          token: 'test-token',
          adminId: testUser.id,
        },
      });

      await prisma.userCompany.create({
        data: {
          userId: testUser.id,
          companyId: testCompany.id,
          role: Role.ADMIN,
        },
      });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .delete(`/api/company/${testCompany.id}`)
        .expect(401);
    });

    it('should only allow admin to delete company', async () => {
      // Boshqa user yaratish
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
        .delete(`/api/company/${testCompany.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });

    it('should delete company successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/company/${testCompany.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message', 'Company deleted successfully');
      expect(response.body.data.deletedCompany).toHaveProperty('id', testCompany.id);
      expect(response.body.data.deletedCompany).toHaveProperty('subdomain', testCompany.subdomain);

      // Database'da tekshirish
      const deletedCompany = await prisma.company.findUnique({
        where: { id: testCompany.id },
      });

      expect(deletedCompany).toBeNull();
    });

    it('should return 404 for non-existent company', async () => {
      return request(app.getHttpServer())
        .delete('/api/company/99999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
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