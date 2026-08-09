import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.country.findMany({
      include: {
        defaultCurrency: true,
        supportedLanguages: {
          include: {
            language: true,
          },
        },
      },
    });
  }

  async findByCode(code: string) {
    return this.prisma.country.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        defaultCurrency: true,
        supportedLanguages: {
          include: {
            language: true,
          },
        },
      },
    });
  }
}
