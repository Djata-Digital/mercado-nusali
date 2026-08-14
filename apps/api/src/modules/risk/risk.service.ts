import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, RiskAlertStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ListRiskAlertsDto } from './dto/list-risk-alerts.dto';
import { UpdateRiskAlertStatusDto } from './dto/update-risk-alert-status.dto';
import { AssignRiskAlertDto } from './dto/assign-risk-alert.dto';
import { ResolveRiskAlertDto } from './dto/resolve-risk-alert.dto';

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listAlerts(dto: ListRiskAlertsDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RiskAlertWhereInput = {};

    if (dto.status) where.status = dto.status;
    if (dto.severity) where.severity = dto.severity;
    if (dto.type) where.type = dto.type;
    if (dto.country) where.country = dto.country;
    if (dto.entityType) where.entityType = dto.entityType;

    if (dto.minScore !== undefined || dto.maxScore !== undefined) {
      where.riskScore = {};
      if (dto.minScore !== undefined) where.riskScore.gte = dto.minScore;
      if (dto.maxScore !== undefined) where.riskScore.lte = dto.maxScore;
    }

    if (dto.search && dto.search.trim() !== '') {
      const query = dto.search.trim();
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { ruleCode: { contains: query, mode: 'insensitive' } },
        { entityId: { contains: query, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.riskAlert.count({ where }),
      this.prisma.riskAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { detectedAt: 'desc' },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          resolvedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  async getAlertById(id: string) {
    const alert: any = await this.prisma.riskAlert.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        resolvedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
          },
        },
        seller: {
          select: {
            id: true,
            legalName: true,
            tradeName: true,
            status: true,
            sellerType: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            method: true,
            provider: true,
          },
        },
        payout: {
          select: {
            id: true,
            amount: true,
            status: true,
            payoutMethod: true,
          },
        },
        history: {
          orderBy: { createdAt: 'asc' },
          include: {
            performedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alerta de risco [${id}] não encontrado.`);
    }

    let relatedEntity: any = null;

    if (alert.user) relatedEntity = { type: 'USER', ...alert.user };
    else if (alert.seller) relatedEntity = { type: 'SELLER', ...alert.seller };
    else if (alert.order) relatedEntity = { type: 'ORDER', ...alert.order };
    else if (alert.payment) relatedEntity = { type: 'PAYMENT', ...alert.payment };
    else if (alert.payout) relatedEntity = { type: 'PAYOUT', ...alert.payout };
    else if (alert.entityId) {
      relatedEntity = { type: alert.entityType, entityId: alert.entityId };
    }

    const { user, seller, order, payment, payout, history, ...cleanAlert } = alert;

    return {
      alert: cleanAlert,
      history: history || [],
      relatedEntity,
    };
  }

  async updateStatus(
    id: string,
    dto: UpdateRiskAlertStatusDto,
    adminUser: any,
    reqInfo?: { ipAddress?: string; userAgent?: string },
  ) {
    const alert = await this.prisma.riskAlert.findUnique({
      where: { id },
    });

    if (!alert) {
      throw new NotFoundException(`Alerta de risco [${id}] não encontrado.`);
    }

    const oldStatus = alert.status;

    const updatedAlert = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.riskAlert.update({
        where: { id },
        data: {
          status: dto.status,
        },
      });

      await tx.riskAlertHistory.create({
        data: {
          riskAlertId: id,
          action: 'STATUS_CHANGED',
          note: dto.note,
          oldStatus,
          newStatus: dto.status,
          performedById: adminUser.id,
        },
      });

      return updated;
    });

    await this.auditService.log({
      userId: adminUser.id,
      action: 'RISK_ALERT_STATUS_CHANGED',
      entity: 'RiskAlert',
      entityId: id,
      previousValue: { status: oldStatus },
      newValue: { status: dto.status, note: dto.note },
      ipAddress: reqInfo?.ipAddress,
      userAgent: reqInfo?.userAgent,
    });

    return updatedAlert;
  }

  async assignAlert(
    id: string,
    dto: AssignRiskAlertDto,
    adminUser: any,
    reqInfo?: { ipAddress?: string; userAgent?: string },
  ) {
    const alert = await this.prisma.riskAlert.findUnique({
      where: { id },
    });

    if (!alert) {
      throw new NotFoundException(`Alerta de risco [${id}] não encontrado.`);
    }

    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!assignee) {
      throw new NotFoundException(
        `Usuário responsável [${dto.assignedToId}] não encontrado.`,
      );
    }

    const oldAssigneeId = alert.assignedToId;

    const updatedAlert = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.riskAlert.update({
        where: { id },
        data: {
          assignedToId: dto.assignedToId,
        },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      await tx.riskAlertHistory.create({
        data: {
          riskAlertId: id,
          action: 'ALERT_ASSIGNED',
          note: dto.note ?? `Atribuído para ${assignee.firstName} ${assignee.lastName}`,
          performedById: adminUser.id,
          metadata: { assignedToId: dto.assignedToId },
        },
      });

      return updated;
    });

    await this.auditService.log({
      userId: adminUser.id,
      action: 'RISK_ALERT_ASSIGNED',
      entity: 'RiskAlert',
      entityId: id,
      previousValue: { assignedToId: oldAssigneeId },
      newValue: { assignedToId: dto.assignedToId, note: dto.note },
      ipAddress: reqInfo?.ipAddress,
      userAgent: reqInfo?.userAgent,
    });

    return updatedAlert;
  }

  async resolveAlert(
    id: string,
    dto: ResolveRiskAlertDto,
    adminUser: any,
    reqInfo?: { ipAddress?: string; userAgent?: string },
  ) {
    if (
      dto.status !== RiskAlertStatus.RESOLVED &&
      dto.status !== RiskAlertStatus.FALSE_POSITIVE
    ) {
      throw new BadRequestException(
        'O status de resolução deve ser RESOLVED ou FALSE_POSITIVE.',
      );
    }

    const alert = await this.prisma.riskAlert.findUnique({
      where: { id },
    });

    if (!alert) {
      throw new NotFoundException(`Alerta de risco [${id}] não encontrado.`);
    }

    const oldStatus = alert.status;

    const updatedAlert = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.riskAlert.update({
        where: { id },
        data: {
          status: dto.status,
          resolvedAt: new Date(),
          resolvedById: adminUser.id,
          resolution: dto.resolution,
        },
        include: {
          resolvedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      await tx.riskAlertHistory.create({
        data: {
          riskAlertId: id,
          action:
            dto.status === RiskAlertStatus.RESOLVED
              ? 'ALERT_RESOLVED'
              : 'ALERT_FALSE_POSITIVE',
          note: dto.note,
          oldStatus,
          newStatus: dto.status,
          performedById: adminUser.id,
          metadata: { resolution: dto.resolution },
        },
      });

      return updated;
    });

    const auditAction =
      dto.status === RiskAlertStatus.RESOLVED
        ? 'RISK_ALERT_RESOLVED'
        : 'RISK_ALERT_FALSE_POSITIVE';

    await this.auditService.log({
      userId: adminUser.id,
      action: auditAction,
      entity: 'RiskAlert',
      entityId: id,
      previousValue: { status: oldStatus },
      newValue: {
        status: dto.status,
        resolution: dto.resolution,
        note: dto.note,
      },
      ipAddress: reqInfo?.ipAddress,
      userAgent: reqInfo?.userAgent,
    });

    return updatedAlert;
  }
}
