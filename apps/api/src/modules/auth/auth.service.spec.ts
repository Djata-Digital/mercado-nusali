import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { HashUtil } from '../../common/utils/hash.util';
import {
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

describe('AuthService Detailed Requirement Tests', () => {
  let authService: AuthService;
  let prismaService: any;
  let usersService: any;

  const mockUser = {
    id: 'user-uuid-1',
    firstName: 'Amadou',
    lastName: 'Diallo',
    email: 'amadou@example.com',
    phone: '955123456',
    phoneCode: '+245',
    passwordHash: 'hashedpassword',
    status: 'active',
    isEmailVerified: false,
    isPhoneVerified: false,
    createdAt: new Date(),
  };

  const mockUserDto = {
    id: mockUser.id,
    firstName: mockUser.firstName,
    lastName: mockUser.lastName,
    email: mockUser.email,
    roles: ['BUYER'],
    permissions: [],
    createdAt: mockUser.createdAt.toISOString(),
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      country: {
        findUnique: jest.fn().mockResolvedValue({ id: 'country-gw', defaultCurrencyId: 'curr-xof' }),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue({ id: 'role-buyer', name: 'BUYER' }),
      },
      session: {
        create: jest.fn().mockResolvedValue({ id: 'session-123' }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'session-123', userAgent: 'Chrome', ipAddress: '127.0.0.1', country: 'GW', lastActiveAt: new Date() },
          { id: 'session-456', userAgent: 'Safari', ipAddress: '127.0.0.1', country: 'GW', lastActiveAt: new Date() },
        ]),
        findFirst: jest.fn().mockResolvedValue({ id: 'session-123', userId: 'user-uuid-1' }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      verificationToken: {
        create: jest.fn().mockResolvedValue({ id: 'verif-1', challengeId: 'challenge-new-123' }),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
    };

    usersService = {
      findByEmailOrPhone: jest.fn(),
      findById: jest.fn(),
      formatUserDto: jest.fn().mockReturnValue(mockUserDto),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mocked-jwt-access-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => (key === 'jwt.secret' ? 'test-secret' : null)),
          },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
        {
          provide: MailService,
          useValue: {
            sendPasswordResetEmail: jest.fn(),
            sendVerificationEmail: jest.fn(),
            sendVerificationSms: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('Registration Rules', () => {
    it('should reject registration when country does not exist', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);
      prismaService.country.findUnique.mockResolvedValue(null);

      await expect(
        authService.register(
          {
            country: 'XX',
            role: 'BUYER',
            firstName: 'Amadou',
            lastName: 'Diallo',
            email: 'amadou@example.com',
            phone: '955123456',
            phoneCode: '+245',
            password: 'Password123!',
            termsAccepted: true,
            privacyAccepted: true,
          },
          {},
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Login & Suspended Accounts', () => {
    it('should block login for suspended or blocked accounts', async () => {
      const passwordHash = await HashUtil.hashPassword('Password123!');
      usersService.findByEmailOrPhone.mockResolvedValue({
        ...mockUser,
        passwordHash,
        status: 'suspended',
      });

      await expect(
        authService.login(
          { identifier: 'amadou@example.com', password: 'Password123!' },
          {},
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Sessions & Logout', () => {
    it('should list sessions and mark isCurrent correctly', async () => {
      const sessions = await authService.getSessions('user-uuid-1', 'session-123');
      expect(sessions.length).toBe(2);
      expect(sessions.find((s) => s.id === 'session-123')?.isCurrent).toBe(true);
      expect(sessions.find((s) => s.id === 'session-456')?.isCurrent).toBe(false);
    });

    it('should revoke current session and its refresh tokens on logout', async () => {
      await authService.logout('user-uuid-1', 'session-123', {});
      expect(prismaService.session.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-123', userId: 'user-uuid-1' },
        data: { isRevoked: true },
      });
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
        data: { isRevoked: true },
      });
    });

    it('should revoke all sessions and tokens on revokeAllSessions', async () => {
      await authService.revokeAllSessions('user-uuid-1');
      expect(prismaService.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
        data: { isRevoked: true },
      });
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
        data: { isRevoked: true },
      });
    });

    it('should revoke specific session by ID', async () => {
      await authService.revokeSession('user-uuid-1', 'session-456');
      expect(prismaService.session.update).toHaveBeenCalledWith({
        where: { id: 'session-456' },
        data: { isRevoked: true },
      });
    });
  });

  describe('Verification Flow by challengeId', () => {
    it('should return challengeId on resending verification code', async () => {
      usersService.findById.mockResolvedValue(mockUserDto);
      const res = await authService.resendVerification('email', 'user-uuid-1');
      expect(res).toHaveProperty('challengeId');
      expect(prismaService.verificationToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-uuid-1',
          type: 'email',
          challengeId: expect.any(String),
        }),
      });
    });

    it('should verify email using challengeId and matching hash', async () => {
      const code = '123456';
      const tokenHash = HashUtil.hashToken(code);

      prismaService.verificationToken.findUnique.mockResolvedValue({
        id: 'verif-id-1',
        challengeId: 'challenge-uuid-1',
        userId: 'user-uuid-1',
        tokenHash,
        type: 'email',
        attempts: 0,
        usedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });

      prismaService.user.update.mockResolvedValue(mockUser);
      usersService.findById.mockResolvedValue(mockUserDto);

      const res = await authService.verifyEmail({ challengeId: 'challenge-uuid-1', code }, {});
      expect(res.message).toContain('sucesso');
    });

    it('should increment attempts on invalid code during verification', async () => {
      const tokenHash = HashUtil.hashToken('123456');

      prismaService.verificationToken.findUnique.mockResolvedValue({
        id: 'verif-id-1',
        challengeId: 'challenge-uuid-1',
        userId: 'user-uuid-1',
        tokenHash,
        type: 'email',
        attempts: 1,
        usedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        authService.verifyEmail({ challengeId: 'challenge-uuid-1', code: '999999' }, {}),
      ).rejects.toThrow(BadRequestException);

      expect(prismaService.verificationToken.update).toHaveBeenCalledWith({
        where: { id: 'verif-id-1' },
        data: { attempts: { increment: 1 } },
      });
    });
  });
});
