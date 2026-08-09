import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LanguagesService } from './languages.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Languages')
@Controller('languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar idiomas suportados (pt, en, fr)' })
  async findAll() {
    return this.languagesService.findAll();
  }
}
