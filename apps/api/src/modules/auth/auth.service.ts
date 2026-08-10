import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { HashUtil } from '../../common/utils/hash.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

export interface RequestInfo {
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  requestId?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto, reqInfo: RequestInfo) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email.toLowerCase() }, { phone: dto.phone }],
      },
    });

    if (existing) {
      throw new ConflictException('E-mail ou telefone já cadastrado na plataforma.');
    }

    const country = await this.prisma.country.findUnique({
      where: { code: dto.country.toUpperCase() },
      include: { defaultCurrency: true },
    });

    if (!country) {
      throw new BadRequestException('País não encontrado ou não suportado.');
    }

    const requestedRole = dto.role?.trim().toUpperCase();

    if (!['BUYER', 'SELLER'].includes(requestedRole)) {
      throw new BadRequestException('Role inválida. Utilize BUYER ou SELLER.');
    }

    const role = await this.prisma.role.findUnique({
      where: { name: requestedRole },
    });

    if (!role) {
      throw new NotFoundException(
        `Role ${requestedRole} não configurada no sistema.`,
      );
    }

    const passwordHash = await HashUtil.hashPassword(dto.password);
    const sellerOnboardingStatus = requestedRole === 'SELLER' ? 'pending' : null;

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        phoneCode: dto.phoneCode,
        passwordHash,
        status: 'active',
        sellerOnboardingStatus,
        countryId: country.id,
        preferredCurrencyId: country.defaultCurrencyId,
        roles: {
          create: {
            roleId: role.id,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        country: true,
        preferredCurrency: true,
      },
    });

    const userDto = this.usersService.formatUserDto(user);

    // 1. Create Session
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
        country: reqInfo.country || dto.country,
      },
    });

    // 2. Generate Tokens linked to Session
    const tokens = await this.generateTokenPair(
      userDto.id,
      userDto.email,
      userDto.roles,
      session.id,
      reqInfo,
    );

    await this.auditService.log({
      userId: user.id,
      action: 'REGISTER',
      entity: 'User',
      entityId: user.id,
      newValue: { email: user.email, role: requestedRole, sellerOnboardingStatus,},
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
      country: dto.country,
      requestId: reqInfo.requestId,
    });

    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userDto,
    };
  }

  async login(dto: LoginDto, reqInfo: RequestInfo) {
    const user = await this.usersService.findByEmailOrPhone(dto.identifier);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isPasswordValid = await HashUtil.comparePassword(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Conta suspensa, bloqueada ou inativa.');
    }

    const userDto = this.usersService.formatUserDto(user);

    // 1. Create Session
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
        country: reqInfo.country,
      },
    });

    // 2. Generate Tokens linked to Session
    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
      userDto.roles,
      session.id,
      reqInfo,
    );

    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
      country: reqInfo.country,
      requestId: reqInfo.requestId,
    });

    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userDto,
    };
  }

  async refresh(refreshTokenString: string, reqInfo: RequestInfo) {
    const tokenHash = HashUtil.hashToken(refreshTokenString);
    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true, session: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Token de renovação inválido.');
    }

    // Reuse Detection: Revoke compromised family & its associated session
    if (tokenRecord.isRevoked) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: tokenRecord.familyId },
        data: { isRevoked: true },
      });

      if (tokenRecord.sessionId) {
        await this.prisma.session.update({
          where: { id: tokenRecord.sessionId },
          data: { isRevoked: true },
        });
      }

      await this.auditService.log({
        userId: tokenRecord.userId,
        action: 'TOKEN_REUSE_DETECTED',
        entity: 'RefreshToken',
        entityId: tokenRecord.id,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
        requestId: reqInfo.requestId,
      });

      throw new UnauthorizedException(
        'Tentativa de reuso de token detectada. A sessão associada foi encerrada por segurança.',
      );
    }

    if (tokenRecord.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException('Token de renovação expirado.');
    }

    // Check if session is revoked
    if (tokenRecord.session && tokenRecord.session.isRevoked) {
      throw new UnauthorizedException('Sessão revogada.');
    }

    // Rotate token within same family & SAME session
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    // Update lastActiveAt on existing session
    if (tokenRecord.sessionId) {
      await this.prisma.session.update({
        where: { id: tokenRecord.sessionId },
        data: { lastActiveAt: new Date() },
      });
    }

    const userDto = await this.usersService.findById(tokenRecord.userId);
    const newTokens = await this.generateTokenPair(
      userDto.id,
      userDto.email,
      userDto.roles,
      tokenRecord.sessionId,
      reqInfo,
      tokenRecord.familyId,
    );

    return {
      token: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    };
  }

  async logout(userId: string, currentSessionId: string | undefined, reqInfo: RequestInfo) {
    if (currentSessionId) {
      await this.prisma.session.updateMany({
        where: { id: currentSessionId, userId },
        data: { isRevoked: true },
      });

      await this.prisma.refreshToken.updateMany({
        where: { sessionId: currentSessionId },
        data: { isRevoked: true },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    await this.auditService.log({
      userId,
      action: 'LOGOUT',
      entity: 'User',
      entityId: userId,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
      requestId: reqInfo.requestId,
    });

    return { message: 'Logout realizado com sucesso.' };
  }

  async forgotPassword(dto: ForgotPasswordDto, reqInfo: RequestInfo) {
    const user = await this.usersService.findByEmailOrPhone(dto.identifier);
    if (user) {
      const resetToken = HashUtil.generateRandomToken(20);
      const tokenHash = HashUtil.hashToken(resetToken);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          method: dto.method || 'email',
          expiresAt,
        },
      });

      await this.mailService.sendPasswordResetEmail(user.email, resetToken);
    }

    return {
      message: 'Se o identificador existir, as instruções foram enviadas com sucesso.',
      methodSent: dto.method || 'email',
    };
  }

  async resetPassword(dto: ResetPasswordDto, reqInfo: RequestInfo) {
    const token = dto.token || dto.code;
    if (!token) {
      throw new BadRequestException('Token ou código de redefinição obrigatório.');
    }

    const tokenHash = HashUtil.hashToken(token);

    const resetRecord = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetRecord) {
      throw new BadRequestException('Token de redefinição inválido ou expirado.');
    }

    const passwordHash = await HashUtil.hashPassword(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { isUsed: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: resetRecord.userId },
        data: { isRevoked: true },
      }),
      this.prisma.session.updateMany({
        where: { userId: resetRecord.userId },
        data: { isRevoked: true },
      }),
    ]);

    await this.auditService.log({
      userId: resetRecord.userId,
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: resetRecord.userId,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
      requestId: reqInfo.requestId,
    });

    return { message: 'Senha redefinida com sucesso.' };
  }

  async verifyEmail(dto: VerifyEmailDto, reqInfo: RequestInfo) {
    const record = await this.prisma.verificationToken.findUnique({
      where: { challengeId: dto.challengeId },
    });

    if (!record || record.type !== 'email' || record.usedAt !== null || record.expiresAt < new Date()) {
      throw new BadRequestException('Desafio de verificação inválido ou expirado.');
    }

    if (record.attempts >= 5) {
      throw new BadRequestException('Limite de tentativas excedido para este código.');
    }

    const inputHash = HashUtil.hashToken(dto.code);
    if (record.tokenHash !== inputHash) {
      await this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Código de verificação incorreto.');
    }

    const updated = await this.prisma.user.update({
      where: { id: record.userId },
      data: { isEmailVerified: true },
    });

    await this.prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const userDto = await this.usersService.findById(updated.id);
    return { user: userDto, message: 'E-mail verificado com sucesso.' };
  }

  async verifyPhone(dto: VerifyPhoneDto, reqInfo: RequestInfo) {
    const record = await this.prisma.verificationToken.findUnique({
      where: { challengeId: dto.challengeId },
    });

    if (!record || record.type !== 'phone' || record.usedAt !== null || record.expiresAt < new Date()) {
      throw new BadRequestException('Desafio de verificação inválido ou expirado.');
    }

    if (record.attempts >= 5) {
      throw new BadRequestException('Limite de tentativas excedido para este código.');
    }

    const inputHash = HashUtil.hashToken(dto.code);
    if (record.tokenHash !== inputHash) {
      await this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Código de verificação incorreto.');
    }

    const updated = await this.prisma.user.update({
      where: { id: record.userId },
      data: { isPhoneVerified: true },
    });

    await this.prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const userDto = await this.usersService.findById(updated.id);
    return { user: userDto, message: 'Telefone verificado com sucesso.' };
  }

  async resendVerification(type: 'email' | 'phone', userId: string) {
    const user = await this.usersService.findById(userId);

    // Invalidate previous active tokens of same type for user
    await this.prisma.verificationToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { expiresAt: new Date() },
    });

    const code = HashUtil.generateOtpCode(6);
    const tokenHash = HashUtil.hashToken(code);
    const challengeId = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.verificationToken.create({
      data: {
        challengeId,
        userId,
        type,
        tokenHash,
        expiresAt,
      },
    });

    if (type === 'email') {
      await this.mailService.sendVerificationEmail(user.email, code);
    } else {
      await this.mailService.sendVerificationSms(user.phone, code);
    }

    return {
      message: 'Código de verificação reenviado com sucesso.',
      challengeId,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, currentSessionId: string | undefined, reqInfo: RequestInfo) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const isValid = await HashUtil.comparePassword(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Senha atual incorreta.');
    }

    const passwordHash = await HashUtil.hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    if (currentSessionId) {
      await this.prisma.session.updateMany({
        where: { userId, NOT: { id: currentSessionId } },
        data: { isRevoked: true },
      });
      await this.prisma.refreshToken.updateMany({
        where: { userId, NOT: { sessionId: currentSessionId } },
        data: { isRevoked: true },
      });
    } else {
      await this.prisma.session.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
      await this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
    }

    await this.auditService.log({
      userId,
      action: 'PASSWORD_CHANGE',
      entity: 'User',
      entityId: userId,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
      requestId: reqInfo.requestId,
    });

    return { message: 'Senha alterada com sucesso.' };
  }

  async getSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, isRevoked: false },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      device: s.userAgent || 'Dispositivo desconhecido',
      ip: s.ipAddress || '0.0.0.0',
      location: s.country || 'Desconhecida',
      lastActive: s.lastActiveAt.toISOString(),
      isCurrent: s.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Sessão não encontrada.');
    }

    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: sessionId },
        data: { isRevoked: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { sessionId },
        data: { isRevoked: true },
      }),
    ]);

    return { message: 'Sessão revogada com sucesso.' };
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { userId },
        data: { isRevoked: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      }),
    ]);

    return { message: 'Todas as sessões foram encerradas com sucesso.' };
  }

  private async generateTokenPair(
    userId: string,
    email: string,
    roles: string[],
    sessionId: string,
    reqInfo: RequestInfo,
    existingFamilyId?: string,
  ) {
    const payload = { sub: userId, email, roles, sessionId };
    const accessToken = this.jwtService.sign(payload);

    const refreshTokenRaw = HashUtil.generateRandomToken(40);
    const refreshTokenHash = HashUtil.hashToken(refreshTokenRaw);
    const familyId = existingFamilyId || uuidv4();

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        sessionId,
        tokenHash: refreshTokenHash,
        familyId,
        expiresAt,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      },
    });

    return { accessToken, refreshToken: refreshTokenRaw };
  }
}
