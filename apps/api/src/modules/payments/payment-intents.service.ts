import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentIntentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createIntent(userId: string, orderGroupId: string) {
    const orderGroup = await this.prisma.orderGroup.findUnique({
      where: { id: orderGroupId },
      include: { currency: true, orders: true },
    });

    if (!orderGroup) throw new NotFoundException('Grupo de pedidos não encontrado.');
    if (orderGroup.userId !== userId) throw new ForbiddenException('Acesso negado ao grupo de pedidos.');

    if (orderGroup.status === 'CANCELLED' || orderGroup.status === 'EXPIRED') {
      throw new BadRequestException('Não é possível criar pagamento para um grupo de pedidos cancelado ou expirado.');
    }
    if (orderGroup.status === 'PAID' || orderGroup.status === 'COMPLETED') {
      throw new BadRequestException('Este grupo de pedidos já foi pago.', 'ORDER_ALREADY_PAID');
    }

    // Requirement 3: Nunca permitir dois PaymentIntent ativos para o mesmo OrderGroup
    const existingIntent = await this.prisma.paymentIntent.findUnique({
      where: { orderGroupId },
    });

    if (existingIntent) {
      if (existingIntent.status === PaymentStatus.CREATED || existingIntent.status === PaymentStatus.PENDING || existingIntent.status === PaymentStatus.PROCESSING) {
        return existingIntent;
      }
      if (existingIntent.status === PaymentStatus.CAPTURED || existingIntent.status === PaymentStatus.AUTHORIZED) {
        throw new ConflictException('Já existe um pagamento autorizado ou capturado para este pedido.');
      }
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

    return this.prisma.paymentIntent.create({
      data: {
        orderGroupId,
        buyerId: userId,
        amount: orderGroup.total,
        currencyId: orderGroup.currencyId,
        status: PaymentStatus.CREATED,
        expiresAt,
      },
    });
  }

  async getIntentById(userId: string, intentId: string) {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: { currency: true, payments: true },
    });

    if (!intent) throw new NotFoundException('Intenção de pagamento não encontrada.');
    if (intent.buyerId !== userId) throw new ForbiddenException('Acesso negado.');

    return intent;
  }
}
