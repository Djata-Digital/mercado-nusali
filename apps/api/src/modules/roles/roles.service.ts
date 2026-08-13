import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import {
  CreateRoleDto,
  UpdateRoleDto,
} from './dto/admin-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private readonly protectedRoles =
    new Set([
      'GLOBAL_ADMIN',
      'ADMIN',
      'BUYER',
      'SELLER',
    ]);

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: {
        name: 'asc',
      },

      include: {
        _count: {
          select: {
            users: true,
          },
        },

        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async findByName(name: string) {
    return this.prisma.role.findUnique({
      where: {
        name,
      },

      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  private async resolvePermissions(
    slugs: string[],
  ) {
    const normalized = [
      ...new Set(
        slugs.map((slug) =>
          slug.trim(),
        ),
      ),
    ];

    const permissions =
      await this.prisma.permission.findMany({
        where: {
          slug: {
            in: normalized,
          },
        },
      });

    if (
      permissions.length !==
      normalized.length
    ) {
      const found = new Set(
        permissions.map(
          (permission) =>
            permission.slug,
        ),
      );

      const missing =
        normalized.filter(
          (slug) =>
            !found.has(slug),
        );

      throw new BadRequestException(
        `Permissão(ões) inexistente(s): ${missing.join(', ')}`,
      );
    }

    return permissions;
  }

  async create(
    dto: CreateRoleDto,
    actorId: string,
    reqInfo: any,
  ) {
    const name =
      dto.name.trim().toUpperCase();

    const exists =
      await this.prisma.role.findUnique({
        where: {
          name,
        },
      });

    if (exists) {
      throw new ConflictException(
        'Já existe uma role com este nome.',
      );
    }

    const permissions =
      await this.resolvePermissions(
        dto.permissions,
      );

    const role =
      await this.prisma.role.create({
        data: {
          name,

          description:
            dto.description?.trim() ||
            null,

          permissions: {
            create:
              permissions.map(
                (permission) => ({
                  permissionId:
                    permission.id,
                }),
              ),
          },
        },

        include: {
          _count: {
            select: {
              users: true,
            },
          },

          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

    await this.auditService.log({
      userId: actorId,
      action: 'ADMIN_ROLE_CREATED',
      entity: 'Role',
      entityId: role.id,

      newValue: {
        name,
        permissions:
          permissions.map(
            (permission) =>
              permission.slug,
          ),
      },

      ipAddress: reqInfo?.ipAddress,
      userAgent: reqInfo?.userAgent,
      country: reqInfo?.country,
      requestId: reqInfo?.requestId,
    });

    return role;
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
    actorId: string,
    reqInfo: any,
  ) {
    const role =
      await this.prisma.role.findUnique({
        where: {
          id,
        },

        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

    if (!role) {
      throw new NotFoundException(
        'Role não encontrada.',
      );
    }

    const nextName =
      dto.name
        ? dto.name
            .trim()
            .toUpperCase()
        : role.name;

    if (
      this.protectedRoles.has(
        role.name,
      ) &&
      nextName !== role.name
    ) {
      throw new BadRequestException(
        'Uma role estrutural não pode ser renomeada.',
      );
    }

    const permissions =
      dto.permissions
        ? await this.resolvePermissions(
            dto.permissions,
          )
        : null;

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          await tx.role.update({
            where: {
              id,
            },

            data: {
              name: nextName,

              description:
                dto.description !==
                undefined
                  ? dto.description.trim()
                  : undefined,
            },
          });

          if (permissions) {
            await tx.rolePermission.deleteMany({
              where: {
                roleId: id,
              },
            });

            await tx.rolePermission.createMany({
              data:
                permissions.map(
                  (permission) => ({
                    roleId: id,
                    permissionId:
                      permission.id,
                  }),
                ),

              skipDuplicates: true,
            });
          }

          return tx.role.findUniqueOrThrow({
            where: {
              id,
            },

            include: {
              _count: {
                select: {
                  users: true,
                },
              },

              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          });
        },
      );

    await this.auditService.log({
      userId: actorId,
      action: 'ADMIN_ROLE_UPDATED',
      entity: 'Role',
      entityId: id,

      previousValue: {
        name: role.name,

        permissions:
          role.permissions.map(
            (item) =>
              item.permission.slug,
          ),
      },

      newValue: {
        name: updated.name,

        permissions:
          updated.permissions.map(
            (item) =>
              item.permission.slug,
          ),
      },

      ipAddress: reqInfo?.ipAddress,
      userAgent: reqInfo?.userAgent,
      country: reqInfo?.country,
      requestId: reqInfo?.requestId,
    });

    return updated;
  }

  async remove(
    id: string,
    actorId: string,
    reqInfo: any,
  ) {
    const role =
      await this.prisma.role.findUnique({
        where: {
          id,
        },

        include: {
          _count: {
            select: {
              users: true,
            },
          },
        },
      });

    if (!role) {
      throw new NotFoundException(
        'Role não encontrada.',
      );
    }

    if (
      this.protectedRoles.has(role.name)
    ) {
      throw new BadRequestException(
        'Esta role é estrutural e não pode ser excluída.',
      );
    }

    if (role._count.users > 0) {
      throw new ConflictException(
        'Não é possível excluir uma role que ainda possui usuários.',
      );
    }

    await this.prisma.role.delete({
      where: {
        id,
      },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'ADMIN_ROLE_DELETED',
      entity: 'Role',
      entityId: id,

      previousValue: {
        name: role.name,
      },

      ipAddress: reqInfo?.ipAddress,
      userAgent: reqInfo?.userAgent,
      country: reqInfo?.country,
      requestId: reqInfo?.requestId,
    });

    return {
      success: true,
      id,
    };
  }
}