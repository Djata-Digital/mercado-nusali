import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      country: (req.headers['x-country-code'] as string) || undefined,
      requestId: req.requestId,
    };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Cadastro público de novo usuário' })
  @ApiResponse({ status: 201, description: 'Usuário cadastrado com sucesso' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.extractReqInfo(req));
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Autenticação de usuário com emissão de tokens' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.extractReqInfo(req));
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Renovação de access token com rotação e família de tokens' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, this.extractReqInfo(req));
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerramento da sessão atual e invalidação de tokens' })
  async logout(
    @CurrentUser('id') userId: string,
    @CurrentUser('currentSessionId') currentSessionId: string,
    @Req() req: Request,
  ) {
    return this.authService.logout(userId, currentSessionId, this.extractReqInfo(req));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter perfil do usuário autenticado' })
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar redefinição de senha' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto, this.extractReqInfo(req));
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Redefinir senha utilizando token ou código' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.authService.resetPassword(dto, this.extractReqInfo(req));
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verificar endereço de e-mail por código' })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    return this.authService.verifyEmail(dto, this.extractReqInfo(req));
  }

  @Public()
  @Post('verify-phone')
  @ApiOperation({ summary: 'Verificar número de telefone por código' })
  async verifyPhone(@Body() dto: VerifyPhoneDto, @Req() req: Request) {
    return this.authService.verifyPhone(dto, this.extractReqInfo(req));
  }

  @Post('resend-verification')
  @ApiBearerAuth()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reenviar código de verificação' })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.authService.resendVerification(dto.type, userId);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Alterar senha da conta autenticada' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @CurrentUser('currentSessionId') currentSessionId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(userId, dto, currentSessionId, this.extractReqInfo(req));
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar sessões ativas do usuário' })
  async getSessions(
    @CurrentUser('id') userId: string,
    @CurrentUser('currentSessionId') currentSessionId: string,
  ) {
    return this.authService.getSessions(userId, currentSessionId);
  }

  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revogar sessão específica por ID' })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.authService.revokeSession(userId, sessionId);
  }

  @Delete('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revogar todas as sessões do usuário' })
  async revokeAllSessions(@CurrentUser('id') userId: string) {
    return this.authService.revokeAllSessions(userId);
  }
}
