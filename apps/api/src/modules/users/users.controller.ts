import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'SUPPORT')
  @ApiOperation({ summary: 'Obter perfil de usuário por ID (Admin)' })
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
