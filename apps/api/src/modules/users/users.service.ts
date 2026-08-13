import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HashUtil } from '../../common/utils/hash.util';
import {
  AdminCreateUserDto,
  AdminListUsersQueryDto,
} from './dto/admin-user.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
  ) {}

  private readonly userInclude = {
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
    preferredLanguage: true,
  } as const;

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: this.userInclude,
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return this.formatUserDto(user);
  }

  async findByEmailOrPhone(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          {
            email: identifier.toLowerCase(),
          },
          {
            phone: identifier,
          },
        ],
      },
      include: this.userInclude,
    });
  }

  async adminList(query: AdminListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const search = query.search?.trim();

    const where: any = {};

    if (search) {
      where.OR = [
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: search,
          },
        },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.role) {
      where.roles = {
        some: {
          role: {
            name: query.role.trim().toUpperCase(),
          },
        },
      };
    }

    if (query.countryCode) {
      where.country = {
        code: query.countryCode.trim().toUpperCase(),
      };
    }

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({
        where,
      }),

      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: this.userInclude,
      }),
    ]);

    return {
      items: users.map((user) =>
        this.formatUserDto(user),
      ),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async adminCreate(
    dto: AdminCreateUserDto,
    actorId: string,
    reqInfo: any,
  ) {
    const email = dto.email.trim().toLowerCase();
    const rolesRequested = [
      ...new Set(
        dto.roles.map((role) =>
          role.trim().toUpperCase(),
        ),
      ),
    ];

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phone: dto.phone },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        'E-mail ou telefone já cadastrado.',
      );
    }

    const country = await this.prisma.country.findUnique({
      where: {
        code: dto.countryCode
          .trim()
          .toUpperCase(),
      },
    });

    if (!country) {
      throw new BadRequestException(
        'País informado não existe ou não é suportado.',
      );
    }

    const roles = await this.prisma.role.findMany({
      where: {
        name: {
          in: rolesRequested,
        },
      },
    });

    if (roles.length !== rolesRequested.length) {
      const foundNames = new Set(
        roles.map((role) => role.name),
      );

      const missing = rolesRequested.filter(
        (role) => !foundNames.has(role),
      );

      throw new BadRequestException(
        `Role(s) não encontrada(s): ${missing.join(', ')}`,
      );
    }

    /*
     * Usuário criado pelo administrador não recebe
     * uma senha conhecida pelo admin.
     *
     * É gerado um segredo aleatório impossível de usar
     * normalmente e, em seguida, o usuário deve utilizar
     * o fluxo de recuperação de senha.
     */
    const unusablePassword =
      HashUtil.generateRandomToken(48);

    const passwordHash =
      await HashUtil.hashPassword(
        unusablePassword,
      );

    const user =
      await this.prisma.user.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email,
          phone: dto.phone.trim(),
          phoneCode: dto.phoneCode.trim(),
          passwordHash,
          status: 'active',
          countryId: country.id,
          preferredCurrencyId:
            country.defaultCurrencyId,

          roles: {
            create: roles.map((role) => ({
              roleId: role.id,
            })),
          },
        },

        include: this.userInclude,
      });

    await this.auditService.log({
      userId: actorId,
      action: 'ADMIN_USER_CREATED',
      entity: 'User',
      entityId: user.id,

      newValue: {
        email: user.email,
        phone: user.phone,
        roles: rolesRequested,
        status: user.status,
      },

      ipAddress: reqInfo?.ipAddress,
      userAgent: reqInfo?.userAgent,
      country: reqInfo?.country,
      requestId: reqInfo?.requestId,
    });

    return this.formatUserDto(user);
  }

  async adminUpdateStatus(
    targetUserId: string,
    status: string,
    reason: string | undefined,
    actorId: string,
    reqInfo: any,
  ) {
    if (targetUserId === actorId) {
      throw new BadRequestException(
        'Você não pode alterar o status da própria conta administrativa.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: targetUserId,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Usuário não encontrado.',
      );
    }

    if (
      ![
        'active',
        'blocked',
        'suspended',
        'inactive',
      ].includes(status)
    ) {
      throw new BadRequestException(
        'Status de usuário inválido.',
      );
    }

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const updatedUser =
            await tx.user.update({
              where: {
                id: targetUserId,
              },

              data: {
                status,
              },
            });

          /*
           * Se a conta foi impedida de acessar,
           * derruba sessões e refresh tokens.
           */
          if (status !== 'active') {
            await tx.session.updateMany({
              where: {
                userId: targetUserId,
                isRevoked: false,
              },

              data: {
                isRevoked: true,
              },
            });

            await tx.refreshToken.updateMany({
              where: {
                userId: targetUserId,
                isRevoked: false,
              },

              data: {
                isRevoked: true,
              },
            });
          }

          return updatedUser;
        },
      );

    await this.auditService.log({
      userId: actorId,
      action: 'ADMIN_USER_STATUS_UPDATED',
      entity: 'User',
      entityId: targetUserId,

      previousValue: {
        status: user.status,
      },

      newValue: {
        status: updated.status,
        reason: reason ?? null,
      },

      ipAddress: reqInfo?.ipAddress,
      userAgent: reqInfo?.userAgent,
      country: reqInfo?.country,
      requestId: reqInfo?.requestId,
    });

    return this.findById(targetUserId);
  }

  async adminUpdateRoles(
    targetUserId: string,
    roleNames: string[],
    actorId: string,
    reqInfo: any,
  ) {
    const normalizedRoles = [
      ...new Set(
        roleNames.map((role) =>
          role.trim().toUpperCase(),
        ),
      ),
    ];

    if (!normalizedRoles.length) {
      throw new BadRequestException(
        'Informe pelo menos uma role.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: targetUserId,
      },

      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Usuário não encontrado.',
      );
    }

    const roles = await this.prisma.role.findMany({
      where: {
        name: {
          in: normalizedRoles,
        },
      },
    });

    if (
      roles.length !== normalizedRoles.length
    ) {
      const found = new Set(
        roles.map((role) => role.name),
      );

      const missing =
        normalizedRoles.filter(
          (name) => !found.has(name),
        );

      throw new BadRequestException(
        `Role(s) inexistente(s): ${missing.join(', ')}`,
      );
    }

    const previousRoles =
      user.roles.map(
        (item) => item.role.name,
      );

    await this.prisma.$transaction(
      async (tx) => {
        await tx.userRole.deleteMany({
          where: {
            userId: targetUserId,
          },
        });

        await tx.userRole.createMany({
          data: roles.map((role) => ({
            userId: targetUserId,
            roleId: role.id,
          })),

          skipDuplicates: true,
        });

        /*
         * Tokens existentes carregam roles antigas.
         * Revogamos sessões para exigir novo login.
         */
        await tx.session.updateMany({
          where: {
            userId: targetUserId,
            isRevoked: false,
          },

          data: {
            isRevoked: true,
          },
        });

        await tx.refreshToken.updateMany({
          where: {
            userId: targetUserId,
            isRevoked: false,
          },

          data: {
            isRevoked: true,
          },
        });
      },
    );

    await this.auditService.log({
      userId: actorId,
      action: 'ADMIN_USER_ROLES_UPDATED',
      entity: 'User',
      entityId: targetUserId,

      previousValue: {
        roles: previousRoles,
      },

      newValue: {
        roles: normalizedRoles,
      },

      ipAddress: reqInfo?.ipAddress,
      userAgent: reqInfo?.userAgent,
      country: reqInfo?.country,
      requestId: reqInfo?.requestId,
    });

    return this.findById(targetUserId);
  }

  async adminSendPasswordReset(
    targetUserId: string,
    actorId: string,
    reqInfo: any,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: targetUserId,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Usuário não encontrado.',
      );
    }

    const resetToken =
      HashUtil.generateRandomToken(20);

    const tokenHash =
      HashUtil.hashToken(resetToken);

    const expiresAt =
      new Date(
        Date.now() +
          30 * 60 * 1000,
      );

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        method: 'email',
        expiresAt,
      },
    });

    await this.mailService.sendPasswordResetEmail(
      user.email,
      resetToken,
    );

    await this.auditService.log({
      userId: actorId,
      action:
        'ADMIN_PASSWORD_RESET_REQUESTED',
      entity: 'User',
      entityId: user.id,

      newValue: {
        deliveryMethod: 'email',
        expiresInMinutes: 30,
      },

      ipAddress:
        reqInfo?.ipAddress,

      userAgent:
        reqInfo?.userAgent,

      country:
        reqInfo?.country,

      requestId:
        reqInfo?.requestId,
    });

    return {
      message:
        'Instruções de redefinição de senha enviadas ao usuário.',
    };
  }

  formatUserDto(user: any) {
    const roleNames: string[] = [];
    const permissionSlugs =
      new Set<string>();

    if (user.roles) {
      for (const ur of user.roles) {
        if (ur.role) {
          roleNames.push(
            ur.role.name,
          );

          if (ur.role.permissions) {
            for (
              const rp of ur.role.permissions
            ) {
              if (rp.permission) {
                permissionSlugs.add(
                  rp.permission.slug,
                );
              }
            }
          }
        }
      }
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,

      name: `${user.firstName} ${user.lastName}`.trim(),

      email: user.email,
      phone: user.phone,
      phoneCode: user.phoneCode,
      status: user.status,

      isEmailVerified:
        user.isEmailVerified,

      isPhoneVerified:
        user.isPhoneVerified,

      sellerOnboardingStatus:
        user.sellerOnboardingStatus,

      country: user.country
        ? {
            code: user.country.code,
            name: user.country.name,
          }
        : undefined,

      preferredCurrency:
        user.preferredCurrency
          ? {
              code:
                user.preferredCurrency.code,
              symbol:
                user.preferredCurrency.symbol,
            }
          : undefined,

      preferredLanguage:
        user.preferredLanguage
          ? {
              code:
                user.preferredLanguage.code,
              name:
                user.preferredLanguage.name,
            }
          : undefined,

      role: roleNames[0] || 'BUYER',
      roles: roleNames,

      permissions: Array.from(
        permissionSlugs,
      ),

      createdAt:
        user.createdAt?.toISOString?.() ??
        user.createdAt,

      updatedAt:
        user.updatedAt?.toISOString?.() ??
        user.updatedAt,
    };
  }

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
    },
  ) {
    const updated =
      await this.prisma.user.update({
        where: {
          id: userId,
        },

        data,

        include: this.userInclude,
      });

    return this.formatUserDto(updated);
  }
}