export interface PublicTrackingEventResponse {
  eventCode: string;
  status: string;
  title: string;
  description?: string;
  country?: string;
  region?: string;
  city?: string;
  eventAt: Date;
}

export interface PublicTrackingResponse {
  trackingNumber: string;
  carrierName: string;
  currentStatus: string;
  statusDescription: string;
  originCountry?: string;
  destinationCountry?: string;
  estimatedDeliveryAt?: Date;
  deliveredAt?: Date;
  isInternational: boolean;
  events: PublicTrackingEventResponse[];
}

export class PublicTrackingMapper {
  /**
   * Sanitiza a entidade Tracking para exibição em endpoint público.
   */
  static toPublic(tracking: any): PublicTrackingResponse {
    const events: PublicTrackingEventResponse[] = (tracking.events || []).map((event: any) => ({
      eventCode: event.eventCode,
      status: event.status,
      title: PublicTrackingMapper.sanitizeTitle(event.title, event.status),
      description: PublicTrackingMapper.sanitizeDescription(event.description),
      country: event.country?.name || event.countryId || undefined,
      region: event.region || undefined,
      city: event.city || undefined,
      eventAt: event.eventAt,
    }));

    return {
      trackingNumber: tracking.trackingNumber,
      carrierName: tracking.carrier?.name || 'Transportadora Nusali',
      currentStatus: tracking.currentStatus,
      statusDescription: PublicTrackingMapper.getStatusDescription(tracking.currentStatus),
      originCountry: tracking.originCountry?.name || undefined,
      destinationCountry: tracking.destinationCountry?.name || undefined,
      estimatedDeliveryAt: tracking.estimatedDeliveryAt || undefined,
      deliveredAt: tracking.deliveredAt || undefined,
      isInternational: tracking.isInternational || false,
      events,
    };
  }

  private static sanitizeTitle(title: string, status: string): string {
    if (!title) return PublicTrackingMapper.getStatusDescription(status);
    // Remove telefones, CPFs ou códigos de operador brutas
    return title
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[DOCUMENTO]')
      .replace(/\b\+?\d{10,13}\b/g, '[CONTATO]');
  }

  private static sanitizeDescription(description?: string): string | undefined {
    if (!description) return undefined;
    return description
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[REDACT]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]');
  }

  private static getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      LABEL_CREATED: 'Etiqueta de envio gerada. Aguardando entrega à transportadora.',
      PICKUP_SCHEDULED: 'Coleta agendada com a transportadora.',
      PICKED_UP: 'Objeto coletado e em processamento inicial.',
      RECEIVED_AT_ORIGIN_HUB: 'Recebido no Centro de Distribuição de Origem.',
      IN_TRANSIT: 'Em trânsito para a região de destino.',
      ARRIVED_AT_TRANSIT_HUB: 'Chegou ao Centro Logístico Intermediário.',
      DEPARTED_TRANSIT_HUB: 'Saiu do Centro Logístico Intermediário.',
      CUSTOMS_PENDING: 'Em fiscalização aduaneira.',
      CUSTOMS_CLEARED: 'Liberado pela alfândega.',
      CUSTOMS_HELD: 'Retido para verificação documental aduaneira.',
      ARRIVED_AT_DESTINATION_HUB: 'Chegou ao Centro de Distribuição da Cidade de Destino.',
      READY_FOR_DELIVERY: 'Pronto para distribuição local.',
      OUT_FOR_DELIVERY: 'Objeto saiu para entrega ao destinatário.',
      DELIVERY_ATTEMPTED: 'Tentativa de entrega realizada.',
      DELIVERED: 'Entregue com sucesso.',
      DELIVERY_FAILED: 'Não foi possível realizar a entrega.',
      RETURN_REQUESTED: 'Devolução solicitada.',
      RETURN_IN_TRANSIT: 'Em trânsito de devolução ao remetente.',
      RETURNED: 'Objeto devolvido ao remetente.',
      LOST: 'Objeto extraviado em transporte.',
      DAMAGED: 'Objeto avariado em transporte.',
      CANCELLED: 'Envio cancelado.',
      EXCEPTION: 'Ocorrência operacional registrada.',
    };

    return descriptions[status] || 'Em processamento logístico.';
  }
}
