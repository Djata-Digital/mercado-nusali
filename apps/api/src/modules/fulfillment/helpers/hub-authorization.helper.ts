import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export async function validateHubAccess(
  prisma: PrismaService,
  user: any,
  warehouseId?: string,
): Promise<string[] | null> {
  if (!user) {
    throw new ForbiddenException('Usuário não autenticado.');
  }

  const userRoles: string[] = Array.isArray(user.roles)
    ? user.roles.map((r: any) => (typeof r === 'string' ? r : r.role?.name || r.name))
    : [];

  const isGlobalAdmin = userRoles.includes('ADMIN') || userRoles.includes('GLOBAL_ADMIN');
  if (isGlobalAdmin) {
    return null; // Null indica sem restrição de HUB
  }

  // Buscar HUBs onde o usuário é gerente ou operador atribuído
  const managedWarehouses = await prisma.warehouse.findMany({
    where: {
      OR: [
        { managerId: user.id },
        // Outros critérios de atribuição operacional se aplicável
      ],
    },
    select: { id: true },
  });

  const allowedWarehouseIds = managedWarehouses.map((w) => w.id);

  if (warehouseId) {
    if (!allowedWarehouseIds.includes(warehouseId)) {
      throw new ForbiddenException(`Acesso negado: Você não possui autorização operacional para o HUB ${warehouseId}.`);
    }
  }

  return allowedWarehouseIds;
}
