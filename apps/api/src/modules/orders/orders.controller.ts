import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrdersService, AddOrderCommentInput, AddOrderAttachmentInput } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrderStatus } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('my-orders')
  async getMyOrders(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.ordersService.findBuyerOrders(userId);
  }

  @Get('seller')
  async getSellerOrders(@Req() req: any, @Query('storeId') storeId?: string) {
    const userId = req.user.sub || req.user.id;
    return this.ordersService.findSellerOrders(userId, storeId);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'LOGISTICS', 'SUPPORT')
  async getAllAdmin(
    @Query('status') status?: OrderStatus,
    @Query('storeId') storeId?: string,
    @Query('sellerId') sellerId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.ordersService.findAllAdmin({ status, storeId, sellerId, userId });
  }

  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.ordersService.findOne(id, req.user);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'LOGISTICS')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @Body('reason') reason?: string,
  ) {
    const operatorId = req.user.sub || req.user.id;
    return this.ordersService.updateStatus(id, status, reason, operatorId);
  }

  @Post(':id/comments')
  async addComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: AddOrderCommentInput,
  ) {
    const authorId = req.user.sub || req.user.id;
    return this.ordersService.addComment(id, authorId, body, req.user);
  }

  @Post(':id/attachments')
  async addAttachment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: AddOrderAttachmentInput,
  ) {
    const uploaderId = req.user.sub || req.user.id;
    return this.ordersService.addAttachment(id, uploaderId, body, req.user);
  }
}
