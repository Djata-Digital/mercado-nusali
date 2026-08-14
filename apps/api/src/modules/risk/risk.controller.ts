import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { extractRequestInfo } from '../../common/utils/request-info.util';
import { RiskService } from './risk.service';
import { ListRiskAlertsDto } from './dto/list-risk-alerts.dto';
import { UpdateRiskAlertStatusDto } from './dto/update-risk-alert-status.dto';
import { AssignRiskAlertDto } from './dto/assign-risk-alert.dto';
import { ResolveRiskAlertDto } from './dto/resolve-risk-alert.dto';

@ApiTags('Risk & Antifraud')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('risk')
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('admin/alerts')
  @Permissions('risk:read:admin')
  @ApiOperation({ summary: 'Listar alertas de risco administrativos com filtros' })
  async listAlerts(@Query() query: ListRiskAlertsDto) {
    const result = await this.riskService.listAlerts(query);
    return {
      success: true,
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Get('admin/alerts/:id')
  @Permissions('risk:read:admin')
  @ApiOperation({ summary: 'Obter detalhes completos do alerta de risco' })
  async getAlertById(@Param('id') id: string) {
    const result = await this.riskService.getAlertById(id);
    return {
      success: true,
      data: result,
    };
  }

  @Patch('admin/alerts/:id/status')
  @Permissions('risk:investigate:admin')
  @ApiOperation({ summary: 'Atualizar status do alerta de risco' })
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateRiskAlertStatusDto,
  ) {
    const reqInfo = extractRequestInfo(req);
    const updated = await this.riskService.updateStatus(
      id,
      dto,
      req.user,
      reqInfo,
    );
    return {
      success: true,
      data: updated,
    };
  }

  @Patch('admin/alerts/:id/assign')
  @Permissions('risk:investigate:admin')
  @ApiOperation({ summary: 'Atribuir alerta de risco a um analista' })
  async assignAlert(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AssignRiskAlertDto,
  ) {
    const reqInfo = extractRequestInfo(req);
    const updated = await this.riskService.assignAlert(
      id,
      dto,
      req.user,
      reqInfo,
    );
    return {
      success: true,
      data: updated,
    };
  }

  @Post('admin/alerts/:id/resolve')
  @Permissions('risk:resolve:admin')
  @ApiOperation({ summary: 'Resolver alerta de risco ou marcar como falso positivo' })
  async resolveAlert(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ResolveRiskAlertDto,
  ) {
    const reqInfo = extractRequestInfo(req);
    const updated = await this.riskService.resolveAlert(
      id,
      dto,
      req.user,
      reqInfo,
    );
    return {
      success: true,
      data: updated,
    };
  }
}
