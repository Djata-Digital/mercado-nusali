import { Global, Module } from '@nestjs/common';
import { StorePermissionsService } from './services/store-permissions.service';

@Global()
@Module({
  providers: [StorePermissionsService],
  exports: [StorePermissionsService],
})
export class CommonModule {}
