import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CountriesService } from './countries.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Countries')
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar países suportados' })
  async findAll() {
    return this.countriesService.findAll();
  }

  @Public()
  @Get(':code')
  @ApiOperation({ summary: 'Buscar país por código ISO (GW, BR, PT, AO)' })
  async findByCode(@Param('code') code: string) {
    return this.countriesService.findByCode(code);
  }
}
