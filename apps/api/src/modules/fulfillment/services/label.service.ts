import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateLabelDto } from '../dto/shipping.dto';
import { PackingOrderStatus } from '@prisma/client';
import { recordOutboxEvent } from '../helpers/outbox.helper';
import { validateHubAccess } from '../helpers/hub-authorization.helper';

export class ReprintLabelDto {
  reason!: string;
}

@Injectable()
export class LabelService {
  constructor(private readonly prisma: PrismaService) {}

  async generateLabel(dto: GenerateLabelDto, userId?: string, user?: any) {
    const packingOrderId = dto.packingOrderId;
    const carrierName = dto.carrierName?.trim();
    if (!carrierName) {
      throw new BadRequestException('Nome real da transportadora (carrierName) é obrigatório.');
    }
    if (!packingOrderId) {
      throw new BadRequestException('ID da Ordem de Embalagem (packingOrderId) é obrigatório.');
    }

    const packingOrder = await this.prisma.packingOrder.findUnique({
      where: { id: packingOrderId },
      include: {
        order: true,
        shippingLabel: true,
      },
    });

    if (!packingOrder) {
      throw new NotFoundException(`Ordem de Embalagem ${packingOrderId} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, packingOrder.warehouseId);
    }

    if (packingOrder.status !== PackingOrderStatus.PACKED) {
      throw new BadRequestException(`A Ordem de Embalagem precisa estar PACKED para gerar etiqueta. Status atual: ${packingOrder.status}`);
    }

    if (packingOrder.shippingLabel) {
      if (packingOrder.shippingLabel.isInvalidated) {
        throw new BadRequestException('A etiqueta atual da embalagem foi invalidada. Gere ou reimprima com nova solicitação.');
      }
      return this.sanitizeLabelForUser(packingOrder.shippingLabel);
    }

    const randomSuffix = Math.floor(100000 + Math.random() * 900000).toString();
    const labelNumber = `LBL-${Date.now()}-${randomSuffix.substring(0, 4)}`;
    const trackingNumber = `NUS-${Date.now().toString().slice(-6)}-${randomSuffix.substring(0, 4)}`;
    const internalCode = `INT-${packingOrder.packingNumber}`;

    const recipientAddress = (packingOrder.order.addressSnapshotJson as any) || {};
    const recipientName = recipientAddress.recipientName || 'Cliente Nusali';

    const qrCodeData = JSON.stringify({
      lbl: labelNumber,
      trk: trackingNumber,
      ord: packingOrder.order.orderNumber,
      weight: packingOrder.grossWeight ? Number(packingOrder.grossWeight) : 0,
      dest: recipientAddress.city || 'Bissau',
    });

    const barcodeData = trackingNumber;

    const label = await this.prisma.$transaction(async (tx) => {
      const createdLabel = await tx.shippingLabel.create({
        data: {
          labelNumber,
          packingOrderId,
          trackingNumber,
          qrCodeData,
          barcodeData,
          internalCode,
          carrierName,
          recipientName,
          recipientAddressJson: recipientAddress,
          printedAt: new Date(),
          reprintCount: 1,
        },
      });

      await tx.shippingLabelHistory.create({
        data: {
          shippingLabelId: createdLabel.id,
          action: 'GENERATED',
          printedById: userId || null,
          reprintReason: 'Emissão inicial da etiqueta de envio',
        },
      });

      // Exigência 10 & 13: OutboxEvent exclusivamente (sem duplicação por EventEmitter)
      await recordOutboxEvent(tx, 'ShippingLabel', createdLabel.id, 'label.generated', {
        labelId: createdLabel.id,
        labelNumber: createdLabel.labelNumber,
        trackingNumber: createdLabel.trackingNumber,
        packingOrderId,
        printedBy: userId,
      });

      return createdLabel;
    });

    return this.sanitizeLabelForUser(label);
  }

  async getLabelByPackingOrderId(packingOrderId: string, user?: any) {
    const label = await this.prisma.shippingLabel.findUnique({
      where: { packingOrderId },
      include: {
        packingOrder: { include: { order: true } },
        history: {
          include: { printedBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!label) {
      throw new NotFoundException(`Etiqueta para a Ordem de Embalagem ${packingOrderId} não encontrada.`);
    }

    if (user && label.packingOrder) {
      await validateHubAccess(this.prisma, user, label.packingOrder.warehouseId);
    }

    return this.sanitizeLabelForUser(label);
  }

  async reprintLabel(labelId: string, reason?: string, userId?: string, user?: any) {
    const label = await this.prisma.shippingLabel.findUnique({
      where: { id: labelId },
      include: { packingOrder: true },
    });
    if (!label) {
      throw new NotFoundException(`Etiqueta ${labelId} não encontrada.`);
    }

    if (user && label.packingOrder) {
      await validateHubAccess(this.prisma, user, label.packingOrder.warehouseId);
    }

    if (label.isInvalidated) {
      throw new BadRequestException('Não é possível reimprimir uma etiqueta que foi invalidada.');
    }

    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Informe o motivo da reimpressão da etiqueta.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const rep = await tx.shippingLabel.update({
        where: { id: labelId },
        data: {
          printedAt: new Date(),
          reprintCount: { increment: 1 },
        },
      });

      await tx.shippingLabelHistory.create({
        data: {
          shippingLabelId: labelId,
          action: 'REPRINTED',
          printedById: userId || null,
          reprintReason: reason,
        },
      });

      return rep;
    });

    return this.sanitizeLabelForUser(updated);
  }

  private sanitizeLabelForUser(label: any) {
    const addr = label.recipientAddressJson || {};
    return {
      ...label,
      recipientAddressMasked: {
        recipientName: label.recipientName,
        city: addr.city || 'Desconhecido',
        region: addr.region || '',
        maskedStreet: addr.street ? `${addr.street.substring(0, 5)}***` : '***',
      },
    };
  }
}
