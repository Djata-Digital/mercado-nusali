import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerAccountType, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

export interface CreateDoubleEntryDto {
  debitAccount: LedgerAccountType;
  creditAccount: LedgerAccountType;
  amount: Prisma.Decimal | number | string;
  currencyId: string;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  createdById?: string;
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async createDoubleEntry(dto: CreateDoubleEntryDto, txPrisma?: any) {
    const prismaTx = txPrisma || this.prisma;
    const amountDec = new Prisma.Decimal(dto.amount);

    if (amountDec.lte(0)) {
      throw new BadRequestException('O valor do lançamento contábil deve ser positivo.');
    }
    if (dto.debitAccount === dto.creditAccount) {
      throw new BadRequestException('A conta de débito e crédito não podem ser idênticas.');
    }

    const transactionId = `TX-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    const entry = await prismaTx.ledgerEntry.create({
      data: {
        transactionId,
        debitAccount: dto.debitAccount,
        creditAccount: dto.creditAccount,
        amount: amountDec,
        currencyId: dto.currencyId,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        description: dto.description,
        createdById: dto.createdById,
      },
    });

    return entry;
  }

  async listEntries(query: { referenceType?: string; referenceId?: string; account?: LedgerAccountType; limit?: number }) {
    const limit = query.limit || 50;
    const where: any = {};

    if (query.referenceType) where.referenceType = query.referenceType;
    if (query.referenceId) where.referenceId = query.referenceId;
    if (query.account) {
      where.OR = [{ debitAccount: query.account }, { creditAccount: query.account }];
    }

    return this.prisma.ledgerEntry.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { currency: true },
    });
  }
}
