import { Module } from '@nestjs/common';
import { StoreMembersService } from './store-members.service';
import { StoreMembersController } from './store-members.controller';

@Module({
  controllers: [StoreMembersController],
  providers: [StoreMembersService],
  exports: [StoreMembersService],
})
export class StoreMembersModule {}
