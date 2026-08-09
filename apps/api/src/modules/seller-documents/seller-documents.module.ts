import { Module } from '@nestjs/common';
import { SellerDocumentsService } from './seller-documents.service';
import { SellerDocumentsController } from './seller-documents.controller';
import { StorageModule } from '../storage/storage.module';
import { SellerProfilesModule } from '../seller-profiles/seller-profiles.module';

@Module({
  imports: [StorageModule, SellerProfilesModule],
  controllers: [SellerDocumentsController],
  providers: [SellerDocumentsService],
  exports: [SellerDocumentsService],
})
export class SellerDocumentsModule {}
