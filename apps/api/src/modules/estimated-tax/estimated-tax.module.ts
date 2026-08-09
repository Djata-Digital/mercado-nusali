import { Module } from '@nestjs/common';
import { EstimatedTaxService } from './estimated-tax.service';

@Module({
  providers: [EstimatedTaxService],
  exports: [EstimatedTaxService],
})
export class EstimatedTaxModule {}
