import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
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
        preferredLanguage: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return this.formatUserDto(user);
  }

  async findByEmailOrPhone(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
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
        preferredLanguage: true,
      },
    });
  }

  formatUserDto(user: any) {
    const roleNames: string[] = [];
    const permissionSlugs = new Set<string>();

    if (user.roles) {
      for (const ur of user.roles) {
        if (ur.role) {
          roleNames.push(ur.role.name);
          if (ur.role.permissions) {
            for (const rp of ur.role.permissions) {
              if (rp.permission) {
                permissionSlugs.add(rp.permission.slug);
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
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      sellerOnboardingStatus: user.sellerOnboardingStatus,
      country: user.country
        ? { code: user.country.code, name: user.country.name }
        : undefined,
      preferredCurrency: user.preferredCurrency
        ? { code: user.preferredCurrency.code, symbol: user.preferredCurrency.symbol }
        : undefined,
      preferredLanguage: user.preferredLanguage
        ? { code: user.preferredLanguage.code, name: user.preferredLanguage.name }
        : undefined,
      role: roleNames[0] || 'BUYER',
      roles: roleNames,
      permissions: Array.from(permissionSlugs),
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string }) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
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
        preferredLanguage: true,
      },
    });

    return this.formatUserDto(updated);
  }
}
