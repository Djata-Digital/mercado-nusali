import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GenerateLabelDto {
  @ApiPropertyOptional({ example: 'packing-order-uuid-1', description: 'ID da Packing Order embalada' })
  @IsString()
  @IsOptional()
  packingOrderId?: string;

  @ApiPropertyOptional({ example: 'Transportadora Expressa Bissau', description: 'Nome da transportadora de entrega' })
  @IsString()
  @IsOptional()
  carrierName?: string;
}

export class CreateShipmentDto {
  @ApiProperty({ example: 'packing-order-uuid-1', description: 'ID da Packing Order concluída' })
  @IsString()
  @IsNotEmpty()
  packingOrderId!: string;

  @ApiPropertyOptional({ example: 'Expedição pronta na doca 03' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class DispatchShipmentDto {
  @ApiPropertyOptional({ example: 'Entregue ao motorista da transportadora' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CancelShipmentDto {
  @ApiProperty({ example: 'Pedido cancelado pelo cliente antes do despacho', description: 'Motivo do cancelamento' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
