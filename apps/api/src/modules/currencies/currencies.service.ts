import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.currency.findMany();
  }

  async findByCode(code: string) {
    return this.prisma.currency.findUnique({
      where: { code: code.toUpperCase() },
    });
  }
}
