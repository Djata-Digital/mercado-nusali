import { Global, Module } from '@nestjs/common';
import { StorageService, MinioService } from './storage.service';

@Global()
@Module({
  providers: [StorageService, MinioService],
  exports: [StorageService, MinioService],
})
export class StorageModule {}
