# OX Group NestJS Test Task

OX GROUP uchun NestJS backend test task.

## Tezkor Boshlash

```bash
# Clone va setup
git clone [repo-url]
cd ox-group-nestjs-task
npm install

# Environment
cp .env.example .env
# .env faylda PORT ni o'zgartiring
# .env faylda NODE_ENV ni o'zgartiring
# .env faylda JWT_SECRET ni o'zgartiring
# .env faylda OX_API_TOKEN ni o'zgartiring
# .env faylda DATABASE_URL ni o'zgartiring
# .env faylda POSTGRES_DB ni o'zgartiring
# .env faylda POSTGRES_USER ni o'zgartiring
# .env faylda POSTGRES_PASSWORD ni o'zgartiring
# .env faylda POSTGRES_PORT ni o'zgartiring
# .env faylda OX_SUBDOMAIN ni o'zgartiring
# .env faylda OX_API_TOKEN ni o'zgartiring



# Database
npm run db:generate
npm run db:push

# Ishga tushirish
npm run start:dev
```

Loyiha ishga tushgandan keyin:
- **API**: http://localhost:3000
- **Swagger docs**: http://localhost:3000/api

## API Endpoints

### 1. Login
```
POST /auth/login
{
  "email": "test@example.com"
}
```
Response: OTP kodi

### 2. OTP tasdiqlash
```
POST /auth/verify
{
  "email": "test@example.com", 
  "otp": "123456"
}
```
Response: JWT token

### 3. Kompaniya qo'shish
```
POST /register-company
Authorization: Bearer <token>
{
  "token": "Bearer xyz",
  "subdomain": "demo"
}
```

### 4. Kompaniya o'chirish (faqat admin)
```
DELETE /company/:id
Authorization: Bearer <token>
```

### 5. Mahsulotlar (faqat manager/admin)
```
GET /products?page=1&size=10
Authorization: Bearer <token>
```

## Texnologiyalar

- NestJS + Prisma + PostgreSQL
- JWT authentication
- OTP verification
- Custom decorators (@AdminOnly, @ManagerOnly)
- Swagger documentation
- Docker support

## Database

3 ta model:
- **User** - email, otp, otpExpiry
- **Company** - subdomain, token, adminId  
- **UserCompany** - user-company bog'lanish va role

## Role'lar

- **ADMIN** - kompaniya yaratuvchi, o'chira oladi
- **MANAGER** - kompaniya a'zosi, mahsulotlarni ko'ra oladi

## Development Commands

```bash
npm run start:dev      # Development server
npm run db:studio      # Database UI
npm run db:reset       # Database reset
npm run test:e2e       # Run E2E tests
```

## Testing

### E2E Tests

E2E testlarni ishga tushirishdan oldin:

1. **Test environment variables ni sozlang:**
```bash
# Environment variables (test modullarida avtomatik o'rnatiladi)
export JWT_SECRET="test-jwt-secret-key-for-testing"
export OX_API_TOKEN="Bearer test-ox-api-token"
export NODE_ENV="test"
```

2. **Database'ni tayyorlang:**
```bash
# Test database uchun (agar alohida kerak bo'lsa)
npm run db:push
```

3. **Testlarni ishga tushiring:**
```bash
# Barcha e2e testlar
npm run test:e2e

# Bitta test fayl
npm run test:e2e -- auth.e2e-spec.ts
npm run test:e2e -- companies.e2e-spec.ts
npm run test:e2e -- products.e2e-spec.ts

# Watch mode'da
npm run test:e2e -- --watch
```

### Test Coverage

**✅ ALL 29 E2E TESTS PASSING!**

- ✅ **Auth endpoints** (8 tests) - login, verify OTP, JWT
- ✅ **Company management** (12 tests) - register, delete, list  
- ✅ **Products API** (9 tests) - OX API integration, pagination
- ✅ **Role-based access** - Admin/Manager permissions
- ✅ **Error handling** - validation, authentication
- ✅ **Database relationships** - Foreign key constraints
- ✅ **Parallel test safety** - Serialized execution

## Production

```bash
npm run build
npm run start:prod
```

Environment variables:
```
DATABASE_URL="postgresql://..."
JWT_SECRET="strong-secret-key"
NODE_ENV="production"
```

## Muammolar

1. **Database error** - `npm run db:push` ishlatib ko'ring
2. **JWT error** - JWT_SECRET ni tekshiring  
3. **OX API error** - subdomain va token to'g'riligini tekshiring

## Test Qilish

1. Swagger UI'dan test qiling: http://localhost:3000/api
2. yoki cURL:

```bash
# Login
curl -X POST localhost:3000/auth/login \
  -d '{"email":"test@example.com"}' \
  -H "Content-Type: application/json"

# Verify (OTP response'dan oling)
curl -X POST localhost:3000/auth/verify \
  -d '{"email":"test@example.com","otp":"123456"}' \
  -H "Content-Type: application/json"
```