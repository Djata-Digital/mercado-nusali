import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { HashUtil } from '../src/common/utils/hash.util';

describe('App & Full Foundation System (e2e)', () => {
  let app: INestApplication;

  const mockUserActive = {
    id: 'user-uuid-1',
    firstName: 'Amadou',
    lastName: 'Diallo',
    email: 'amadou@example.com',
    phone: '955123456',
    phoneCode: '+245',
    passwordHash: '', // populated in beforeAll
    status: 'active',
    isEmailVerified: false,
    isPhoneVerified: false,
    sellerOnboardingStatus: null,
    countryId: 'country-gw',
    preferredCurrencyId: 'curr-xof',
    preferredLanguageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [
      {
        role: {
          name: 'BUYER',
          permissions: [],
        },
      },
    ],
  };

  const mockUserSuspended = {
    id: 'user-uuid-2',
    firstName: 'Binta',
    lastName: 'Camara',
    email: 'binta@example.com',
    phone: '955654321',
    phoneCode: '+245',
    passwordHash: '',
    status: 'suspended',
    isEmailVerified: true,
    isPhoneVerified: true,
    sellerOnboardingStatus: null,
    countryId: 'country-gw',
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [],
  };

  const mockSessionActive = {
    id: 'session-uuid-1',
    userId: 'user-uuid-1',
    isRevoked: false,
    userAgent: 'e2e-agent',
    ipAddress: '127.0.0.1',
    country: 'GW',
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };

  const mockSessionRevoked = {
    id: 'session-uuid-revoked',
    userId: 'user-uuid-1',
    isRevoked: true,
    userAgent: 'e2e-agent',
    ipAddress: '127.0.0.1',
    country: 'GW',
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };

  const mockVerificationTokenEmail = {
    id: 'verif-email-1',
    challengeId: 'challenge-email-123',
    userId: 'user-uuid-1',
    type: 'email',
    tokenHash: HashUtil.hashToken('123456'),
    attempts: 0,
    usedAt: null,
    expiresAt: new Date(Date.now() + 900000),
    createdAt: new Date(),
  };

  const mockVerificationTokenPhone = {
    id: 'verif-phone-1',
    challengeId: 'challenge-phone-123',
    userId: 'user-uuid-1',
    type: 'phone',
    tokenHash: HashUtil.hashToken('654321'),
    attempts: 0,
    usedAt: null,
    expiresAt: new Date(Date.now() + 900000),
    createdAt: new Date(),
  };

  const mockPasswordResetToken = {
    id: 'reset-token-1',
    userId: 'user-uuid-1',
    tokenHash: HashUtil.hashToken('reset-code-123'),
    method: 'email',
    isUsed: false,
    expiresAt: new Date(Date.now() + 900000),
    createdAt: new Date(),
  };

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $transaction: jest.fn().mockImplementation((arr) => Promise.all(arr)),

    user: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (where?.OR) {
          const email = where.OR[0]?.email;
          if (email === 'amadou@example.com') return Promise.resolve(mockUserActive);
          if (email === 'binta@example.com') return Promise.resolve(mockUserSuspended);
        }
        return Promise.resolve(null);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where?.id === 'user-uuid-1') return Promise.resolve(mockUserActive);
        if (where?.id === 'user-uuid-2') return Promise.resolve(mockUserSuspended);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockUserActive, id: 'new-user-uuid', email: data.email })),
      update: jest.fn().mockResolvedValue(mockUserActive),
    },
    country: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where?.code === 'GW') return Promise.resolve({ id: 'country-gw', code: 'GW', defaultCurrencyId: 'curr-xof' });
        return Promise.resolve(null);
      }),
    },
    role: {
      findUnique: jest.fn().mockResolvedValue({ id: 'role-buyer', name: 'BUYER' }),
    },
    session: {
      create: jest.fn().mockResolvedValue(mockSessionActive),
      findMany: jest.fn().mockResolvedValue([mockSessionActive]),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (where?.id === 'session-uuid-1') return Promise.resolve(mockSessionActive);
        if (where?.id === 'session-uuid-revoked') return Promise.resolve(mockSessionRevoked);
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue(mockSessionActive),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: 'ref-token-1' }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (where?.tokenHash) {
          return Promise.resolve({
            id: 'ref-1',
            userId: 'user-uuid-1',
            sessionId: 'session-uuid-1',
            tokenHash: where.tokenHash,
            familyId: 'family-1',
            isRevoked: false,
            expiresAt: new Date(Date.now() + 900000),
            session: mockSessionActive,
          });
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue({ id: 'ref-1', isRevoked: true }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    verificationToken: {
      create: jest.fn().mockResolvedValue(mockVerificationTokenEmail),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where?.challengeId === 'challenge-email-123') return Promise.resolve(mockVerificationTokenEmail);
        if (where?.challengeId === 'challenge-phone-123') return Promise.resolve(mockVerificationTokenPhone);
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue(mockVerificationTokenEmail),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    passwordResetToken: {
      create: jest.fn().mockResolvedValue(mockPasswordResetToken),
      findFirst: jest.fn().mockResolvedValue(mockPasswordResetToken),
      update: jest.fn().mockResolvedValue(mockPasswordResetToken),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue({
      status: 'ready',
      exists: jest.fn().mockResolvedValue(0),
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(60000),
    }),
  };

  const mockStorageService = {
    checkHealth: jest.fn().mockResolvedValue(true),
  };

  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    mockUserActive.passwordHash = await HashUtil.hashPassword('Password123!');
    mockUserSuspended.passwordHash = await HashUtil.hashPassword('Password123!');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(StorageService)
      .useValue(mockStorageService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoints with PostgreSQL, Redis & Object Storage Check', () => {
    it('/api/v1/health (GET) - full health check', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.services).toEqual({
        database: 'up',
        redis: 'up',
        objectStorage: 'up',
      });
    });

    it('/api/v1/health/live (GET) - liveness probe', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health/live');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('up');
    });

    it('/api/v1/health/ready (GET) - readiness probe returns 200 when all ready', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.services).toEqual({
        database: 'up',
        redis: 'up',
        objectStorage: 'up',
      });
      expect(mockStorageService.checkHealth).toHaveBeenCalled();
    });
  });

  describe('Auth Endpoints E2E Flow', () => {
    it('POST /api/v1/auth/register - success', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          firstName: 'New',
          lastName: 'User',
          email: 'newuser@example.com',
          phone: '955000111',
          phoneCode: '+245',
          password: 'Password123!',
          country: 'GW',
          role: 'BUYER',
          termsAccepted: true,
          privacyAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data).toHaveProperty('user');
    });

    it('POST /api/v1/auth/register - reject invalid country', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          firstName: 'New',
          lastName: 'User',
          email: 'invalidcountry@example.com',
          phone: '955000222',
          phoneCode: '+245',
          password: 'Password123!',
          country: 'INVALID',
          role: 'BUYER',
          termsAccepted: true,
          privacyAccepted: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('País não encontrado');
    });

    it('POST /api/v1/auth/login - success & obtain tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          identifier: 'amadou@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('refreshToken');

      accessToken = res.body.data.token;
      refreshToken = res.body.data.refreshToken;
    });

    it('POST /api/v1/auth/login - block suspended account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          identifier: 'binta@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('suspensa');
    });

    it('GET /api/v1/auth/me - authenticated user profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('amadou@example.com');
      expect(res.body.data).toHaveProperty('currentSessionId');
    });

    it('POST /api/v1/auth/refresh - rotate token in same session', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('POST /api/v1/auth/forgot-password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: 'amadou@example.com', method: 'email' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('sucesso');
    });

    it('POST /api/v1/auth/reset-password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ code: 'reset-code-123', newPassword: 'NewPassword123!' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('sucesso');
    });

    it('POST /api/v1/auth/verify-email with challengeId', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ challengeId: 'challenge-email-123', code: '123456' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('sucesso');
    });

    it('POST /api/v1/auth/verify-phone with challengeId', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-phone')
        .send({ challengeId: 'challenge-phone-123', code: '654321' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('sucesso');
    });

    it('POST /api/v1/auth/logout - current session', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('sucesso');
    });
  });
});
