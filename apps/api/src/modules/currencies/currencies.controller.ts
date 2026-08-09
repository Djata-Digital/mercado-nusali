import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrenciesService } from './currencies.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar moedas suportadas (XOF, BRL, EUR, AOA, USD)' })
  async findAll() {
    return this.currenciesService.findAll();
  }

  @Public()
  @Get(':code')
  @ApiOperation({ summary: 'Buscar moeda por código' })
  async findByCode(@Param('code') code: string) {
    return this.currenciesService.findByCode(code);
  }
}
