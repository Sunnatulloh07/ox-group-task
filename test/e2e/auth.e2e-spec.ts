import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Role } from '@prisma/client';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // JWT secret ni test environment uchun o'rnatish
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
    // OX API token ni test environment uchun o'rnatish
    process.env.OX_API_TOKEN = 'Bearer test-ox-api-token';
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Global pipes va middleware'larni qo'shish
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
  });

  beforeEach(async () => {
    // Har bir test oldidan database'ni tozalash - FK constraint tartib muhim
    await prisma.userCompany.deleteMany();
    await prisma.company.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('/api/auth/login (POST)', () => {
    it('should validate email format', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'invalid-email' })
        .expect(400);
    });

    it('should generate OTP for new user', async () => {
      const uniqueEmail = `new-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: uniqueEmail })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message', 'OTP sent successfully');
      expect(response.body.data).toHaveProperty('otp');
      expect(typeof response.body.data.otp).toBe('string');
      expect(response.body.data.otp).toHaveLength(6);

      // Database'da tekshirish
      const user = await prisma.user.findUnique({
        where: { email: uniqueEmail },
      });

      expect(user).toBeTruthy();
      expect(user.otp).toBe(response.body.data.otp);
      expect(user.otpExpiry).toBeTruthy();
      expect(user.otpExpiry).toBeInstanceOf(Date);
      expect(user.otpExpiry.getTime()).toBeGreaterThan(Date.now());
    });

    it('should generate new OTP for existing user', async () => {
      // Avval user yaratish
      const uniqueEmail = `existing-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const existingUser = await prisma.user.create({
        data: {
          email: uniqueEmail,
          otp: '123456',
          otpExpiry: new Date(Date.now() - 1000), // Expired OTP
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: existingUser.email })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message', 'OTP sent successfully');
      expect(response.body.data).toHaveProperty('otp');
      expect(response.body.data.otp).not.toBe('123456');

      // Database'da tekshirish
      const updatedUser = await prisma.user.findUnique({
        where: { email: existingUser.email },
      });

      expect(updatedUser.otp).toBe(response.body.data.otp);
      expect(updatedUser.otpExpiry).toBeTruthy();
      expect(updatedUser.otpExpiry.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('/api/auth/verify (POST)', () => {
    it('should return 401 for non-existent user', () => {
      const uniqueEmail = `non-existent-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      return request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({
          email: uniqueEmail,
          otp: '123456',
        })
        .expect(401);
    });

    it('should return 401 for invalid OTP', async () => {
      // User yaratish
      const uniqueEmail = `test-invalid-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const testUser = {
        email: uniqueEmail,
        otp: '123456',
      };

      await prisma.user.create({
        data: {
          email: testUser.email,
          otp: testUser.otp,
          otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      return request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({
          email: testUser.email,
          otp: 'wrong-otp',
        })
        .expect(400);
    });

    it('should return 401 for expired OTP', async () => {
      // User yaratish
      const uniqueEmail = `test-expired-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const testUser = {
        email: uniqueEmail,
        otp: '123456',
      };

      await prisma.user.create({
        data: {
          email: testUser.email,
          otp: testUser.otp,
          otpExpiry: new Date(Date.now() - 1000), // Expired OTP
        },
      });

      return request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({
          email: testUser.email,
          otp: testUser.otp,
        })
        .expect(401);
    });

    it('should verify OTP and return JWT token', async () => {
      // User yaratish
      const uniqueEmail = `test-verify-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const testUser = {
        email: uniqueEmail,
        otp: '123456',
      };

      await prisma.user.create({
        data: {
          email: testUser.email,
          otp: testUser.otp,
          otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({
          email: testUser.email,
          otp: testUser.otp,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('access_token');
      expect(typeof response.body.data.access_token).toBe('string');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', testUser.email);

      // Database'da tekshirish
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });

      expect(user.otp).toBeNull();
      expect(user.otpExpiry).toBeNull();
    });

    it('should include user companies in response', async () => {
      const uniqueEmail = `with-company-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const testUser = {
        email: uniqueEmail,
        otp: '123456',
      };

      // User va kompaniya yaratish
      const user = await prisma.user.create({
        data: {
          email: testUser.email,
          otp: testUser.otp,
          otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const company = await prisma.company.create({
        data: {
          subdomain: `test-company-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          token: 'test-token',
          adminId: user.id,
        },
      });

      await prisma.userCompany.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: Role.ADMIN,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({
          email: testUser.email,
          otp: testUser.otp,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('companies');
      expect(response.body.data.user.companies).toHaveLength(1);
      expect(response.body.data.user.companies[0]).toHaveProperty('subdomain', company.subdomain);
      expect(response.body.data.user.companies[0]).toHaveProperty('role', Role.ADMIN);
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