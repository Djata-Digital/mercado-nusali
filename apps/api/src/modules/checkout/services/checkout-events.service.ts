import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface CheckoutStartedEventInput {
  userId: string;
  checkoutSessionId: string;
  cartId: string;
  expiresAt: Date;
}

interface CheckoutExpiredEventInput {
  userId: string;
  checkoutSessionId: string;
  cartId: string;
}


interface CheckoutRecoveredEventInput {
  userId: string;
  checkoutSessionId: string;
  cartId: string;
  action: string;
  referenceId?: string;
}

interface CheckoutRecoveryRequiredEventInput {
  userId: string;
  checkoutSessionId: string;
  cartId: string;
  reason: string;
  referenceId?: string;
}

interface CheckoutCompletedEventInput {
  userId: string;
  checkoutSessionId: string;
  orderGroupId: string;
}

interface ReservationCreatedEventInput {
  userId: string;
  reservationId: string;
  orderGroupId: string;
}

interface OrderCreatedEventInput {
  userId: string;
  orderId: string;
  orderNumber: string;
  total: Prisma.Decimal | number | string;
}

/**
 * CheckoutEventsService
 *
 * Mantém todos os eventos críticos do checkout na Outbox.
 * O serviço nunca publica o mesmo evento por EventEmitter.
 */
@Injectable()
export class CheckoutEventsService {
  recordCheckoutStarted(
    tx: Prisma.TransactionClient,
    input: CheckoutStartedEventInput,
  ) {
    return this.record(tx, {
      aggregateType: 'CheckoutSession',
      aggregateId: input.checkoutSessionId,
      eventType: 'checkout.started',
      payloadJson: {
        eventVersion: 1,
        userId: input.userId,
        cartId: input.cartId,
        checkoutSessionId: input.checkoutSessionId,
        expiresAt: input.expiresAt.toISOString(),
      },
    });
  }


  recordCheckoutExpired(
    tx: Prisma.TransactionClient,
    input: CheckoutExpiredEventInput,
  ) {
    return this.record(tx, {
      aggregateType: 'CheckoutSession',
      aggregateId: input.checkoutSessionId,
      eventType: 'checkout.expired',
      payloadJson: { eventVersion: 1, ...input },
    });
  }


  recordCheckoutRecovered(
    tx: Prisma.TransactionClient,
    input: CheckoutRecoveredEventInput,
  ) {
    return this.record(tx, {
      aggregateType: 'CheckoutSession',
      aggregateId: input.checkoutSessionId,
      eventType: 'checkout.recovered',
      payloadJson: { eventVersion: 1, ...input },
    });
  }

  recordCheckoutRecoveryRequired(
    tx: Prisma.TransactionClient,
    input: CheckoutRecoveryRequiredEventInput,
  ) {
    return this.record(tx, {
      aggregateType: 'CheckoutSession',
      aggregateId: input.checkoutSessionId,
      eventType: 'checkout.recovery_required',
      payloadJson: { eventVersion: 1, ...input },
    });
  }

  recordCheckoutCompleted(
    tx: Prisma.TransactionClient,
    input: CheckoutCompletedEventInput,
  ) {
    return this.record(tx, {
      aggregateType: 'CheckoutSession',
      aggregateId: input.checkoutSessionId,
      eventType: 'checkout.completed',
      payloadJson: { eventVersion: 1, ...input },
    });
  }

  recordReservationCreated(
    tx: Prisma.TransactionClient,
    input: ReservationCreatedEventInput,
  ) {
    return this.record(tx, {
      aggregateType: 'StockReservation',
      aggregateId: input.reservationId,
      eventType: 'reservation.created',
      payloadJson: { eventVersion: 1, ...input },
    });
  }

  recordOrderCreated(
    tx: Prisma.TransactionClient,
    input: OrderCreatedEventInput,
  ) {
    return this.record(tx, {
      aggregateType: 'Order',
      aggregateId: input.orderId,
      eventType: 'order.created',
      payloadJson: {
        eventVersion: 1,
        ...input,
        total: input.total.toString(),
      },
    });
  }

  private record(
    tx: Prisma.TransactionClient,
    event: {
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      payloadJson: Prisma.InputJsonValue;
    },
  ) {
    return tx.outboxEvent.create({ data: event });
  }
}
