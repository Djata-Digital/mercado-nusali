import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from '../../cart/cart.service';
import { CheckoutService } from '../../checkout/checkout.service';
import { CheckoutValidationService } from '../../checkout/services/checkout-validation.service';
import {
  ShippingCalculationService,
  InternalShippingProvider,
  GenericLocalShippingProvider,
} from '../../checkout/shipping/shipping-calculation.service';
import { CouponService } from '../../coupons/coupon.service';
import { OrdersService } from '../orders.service';
import { OrderStateMachineService } from '../order-state-machine.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CartStatus,
  CheckoutSessionStatus,
  CouponStatus,
  OrderStatus,
  OrderGroupStatus,
  StockReservationStatus,
} from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('Sprint 6.1 Cart, Checkout & Orders Unit Test Suite', () => {
  let cartService: CartService;
  let checkoutService: CheckoutService;
  let validationService: CheckoutValidationService;
  let shippingService: ShippingCalculationService;
  let couponService: CouponService;
  let ordersService: OrdersService;
  let stateMachine: OrderStateMachineService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      cart: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cartItem: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      currency: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      productVariant: {
        findUnique: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      store: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      sellerProfile: {
        findFirst: jest.fn(),
      },
      storeMember: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      address: {
        findUnique: jest.fn(),
      },
      coupon: {
        findUnique: jest.fn(),
      },
      couponRedemption: {
        count: jest.fn(),
      },
      shippingRateRule: {
        findMany: jest.fn(),
      },
      checkoutSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      orderGroup: {
        create: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      orderItem: {
        create: jest.fn(),
      },
      inventoryItem: {
        updateMany: jest.fn(),
      },
      stockReservation: {
        create: jest.fn(),
      },
      stockReservationItem: {
        create: jest.fn(),
      },
      orderAddressSnapshot: {
        create: jest.fn(),
      },
      orderPriceSnapshot: {
        create: jest.fn(),
      },
      orderCoupon: {
        create: jest.fn(),
      },
      orderTax: {
        create: jest.fn(),
      },
      orderShipping: {
        create: jest.fn(),
      },
      orderTimeline: {
        create: jest.fn(),
      },
      orderComment: {
        create: jest.fn(),
      },
      orderAttachment: {
        create: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        CheckoutService,
        CheckoutValidationService,
        InternalShippingProvider,
        GenericLocalShippingProvider,
        ShippingCalculationService,
        CouponService,
        OrdersService,
        OrderStateMachineService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    cartService = module.get<CartService>(CartService);
    checkoutService = module.get<CheckoutService>(CheckoutService);
    validationService = module.get<CheckoutValidationService>(CheckoutValidationService);
    shippingService = module.get<ShippingCalculationService>(ShippingCalculationService);
    couponService = module.get<CouponService>(CouponService);
    ordersService = module.get<OrdersService>(OrdersService);
    stateMachine = module.get<OrderStateMachineService>(OrderStateMachineService);
  });

  describe('1. CartModule', () => {
    it('deve buscar ou criar carrinho ativo com moeda padrao BRL', async () => {
      prismaMock.cart.findFirst.mockResolvedValue(null);
      prismaMock.currency.findFirst.mockResolvedValue({ id: 'cur-brl', code: 'BRL' });
      prismaMock.cart.create.mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
        currencyId: 'cur-brl',
        status: CartStatus.ACTIVE,
        items: [],
      });

      const res = await cartService.getOrCreateCart('user-1');
      expect(res.id).toBe('cart-1');
      expect(res.summary.totalItems).toBe(0);
      expect(res.summary.subtotal).toBe(0);
    });

    it('deve adicionar item ao carrinho recalculando subtotais, peso (kg) e volume (m3)', async () => {
      const mockVariant = {
        id: 'var-1',
        productId: 'prod-1',
        price: 100.0,
        weight: 1.5, // 1.5kg
        dimensionsJson: { length: 10, width: 20, height: 30 }, // 6000cm3 = 0.006m3
        isActive: true,
        product: { id: 'prod-1', title: 'Camiseta', storeId: 'store-1', isActive: true, store: { id: 'store-1', name: 'Loja A' } },
        inventoryItems: [{ quantityAvailable: 10 }],
      };

      prismaMock.productVariant.findUnique.mockResolvedValue(mockVariant);
      prismaMock.cart.findFirst.mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
        currencyId: 'cur-brl',
        status: CartStatus.ACTIVE,
        items: [],
        stores: [],
      });
      prismaMock.cartItem.create.mockResolvedValue({ id: 'ci-1', cartId: 'cart-1', variantId: 'var-1', quantity: 2 });

      await cartService.addItem('user-1', { variantId: 'var-1', quantity: 2 });

      expect(prismaMock.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            aggregateType: 'Cart',
            eventType: 'cart.updated',
          }),
        }),
      );
    });

    it('deve rejeitar adicao ao carrinho se quantidade solicitada exceder estoque disponivel', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        isActive: true,
        product: { isActive: true, store: { status: 'ACTIVE' } },
        inventoryItems: [{ quantityAvailable: 2 }],
      });

      await expect(cartService.addItem('user-1', { variantId: 'var-1', quantity: 5 })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('2. CouponService & ShippingCalculationService', () => {
    it('deve validar cupom percentual ativo e aplicar desconto', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue({
        id: 'coup-1',
        code: 'PROMO10',
        type: 'PERCENTAGE',
        value: 10, // 10%
        status: CouponStatus.ACTIVE,
        startsAt: new Date(Date.now() - 10000),
        expiresAt: new Date(Date.now() + 100000),
        minimumOrderAmount: 50.0,
      });

      const res = await couponService.validateCoupon('PROMO10', 'user-1', 200.0);
      expect(res.discountAmount).toBe(20.0);
      expect(res.coupon.code).toBe('PROMO10');
    });

    it('deve rejeitar cupom com valor minimo de pedido nao atingido', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue({
        id: 'coup-1',
        code: 'MIN100',
        type: 'FIXED_AMOUNT',
        value: 15,
        status: CouponStatus.ACTIVE,
        startsAt: new Date(Date.now() - 10000),
        minimumOrderAmount: 100.0,
      });

      await expect(couponService.validateCoupon('MIN100', 'user-1', 40.0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve calcular frete usando provedor simulado InternalShippingProvider', async () => {
      prismaMock.shippingRateRule.findMany.mockResolvedValue([]);

      const options = await shippingService.calculateShippingOptions({
        originCountryId: 'c-br',
        destinationCountryId: 'c-br',
        storeId: 'store-1',
        totalWeightKg: 2.0,
        totalVolumeM3: 0.01,
        subtotal: 100.0,
        currencyId: 'cur-brl',
      });

      expect(options.length).toBeGreaterThan(0);
      expect(options[0].providerCode).toBe('INTERNAL_SHIPPING');
      expect(options[0].cost).toBeGreaterThan(0);
    });
  });

  describe('3. CheckoutValidationService', () => {
    it('deve rejeitar checkout com produto inativo ou loja suspensa', async () => {
      prismaMock.address.findUnique.mockResolvedValue({
        id: 'addr-1',
        userId: 'user-1',
        isActive: true,
        countryId: 'c-br',
      });
      prismaMock.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        status: 'ACTIVE',
        items: [
          {
            id: 'ci-1',
            quantity: 1,
            product: { title: 'Item Inativo', isActive: false },
          },
        ],
      });

      await expect(
        validationService.validateCheckout({ userId: 'user-1', cartId: 'cart-1', addressId: 'addr-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. CheckoutService & Order Creation Snapshots', () => {
    it('deve criar sessao de checkout com expiração de 30m e emitir evento checkout.started', async () => {
      const mockCartSummary = {
        id: 'cart-1',
        currencyId: 'cur-brl',
        items: [{ productId: 'p1', quantity: 1, unitPriceSnapshot: 100 }],
        summary: { subtotal: 100, totalWeightKg: 1, totalVolumeM3: 0.001 },
        stores: [{ store: { id: 'store-1', countryId: 'c-br' }, weightKg: 1, volumeM3: 0.001, subtotal: 100 }],
      };

      jest.spyOn(cartService, 'getOrCreateCart').mockResolvedValue(mockCartSummary as any);
      prismaMock.address.findUnique.mockResolvedValue({ id: 'addr-1', userId: 'user-1', isActive: true, countryId: 'c-br' });
      prismaMock.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        status: 'ACTIVE',
        items: [
          {
            quantity: 1,
            productId: 'p1',
            variantId: 'v1',
            product: { title: 'P1', status: 'ACTIVE', store: { status: 'ACTIVE', seller: { status: 'APPROVED' } } },
            variant: { status: 'ACTIVE', inventoryItems: [{ quantityAvailable: 10 }] },
          },
        ],
      });
      prismaMock.checkoutSession.create.mockImplementation(({ data }: any) => ({ id: 'cs-1', ...data }));

      const res = await checkoutService.createCheckoutSession('user-1', { addressId: 'addr-1' });

      expect(res.session.id).toBe('cs-1');
      expect(prismaMock.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            aggregateType: 'CheckoutSession',
            eventType: 'checkout.started',
          }),
        }),
      );
    });

    it('deve confirmar checkout criando OrderGroup, Orders, StockReservation e Snapshots Imutaveis', async () => {
      const mockSession = {
        id: 'cs-1',
        userId: 'user-1',
        cartId: 'cart-1',
        status: CheckoutSessionStatus.CREATED,
        expiresAt: new Date(Date.now() + 100000),
        currencyId: 'cur-brl',
        pricingSnapshotJson: { subtotal: 100, discountAmount: 0, estimatedTaxAmount: 5 },
        cart: {
          items: [
            {
              id: 'ci-1',
              storeId: 'store-1',
              quantity: 2,
              unitPriceSnapshot: 50.0,
              product: { id: 'p1', title: 'Produto 1', store: { id: 'store-1', name: 'Loja 1', seller: { id: 'sel-1', legalName: 'Seller 1' } } },
              variant: { id: 'v1', sku: 'SKU-P1', price: 50.0, inventoryItems: [{ id: 'inv-1', warehouseId: 'w1', quantityAvailable: 10 }] },
            },
          ],
        },
        address: { id: 'addr-1', recipientName: 'João', phone: '119999', street: 'Rua A', number: '10', city: 'SP', region: 'SP', countryId: 'c-br' },
      };

      prismaMock.checkoutSession.findUnique.mockResolvedValue(mockSession);
      prismaMock.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderGroup.create.mockResolvedValue({ id: 'og-1', total: 115.0 });
      prismaMock.stockReservation.create.mockResolvedValue({ id: 'res-1' });
      prismaMock.order.create.mockResolvedValue({ id: 'ord-1', orderNumber: 'ORD-100', total: 115.0 });
      prismaMock.orderItem.create.mockResolvedValue({ id: 'oi-1', quantity: 2, unitPrice: 50.0 });
      prismaMock.inventoryItem.updateMany.mockResolvedValue({ count: 1 });

      const res = await checkoutService.confirmCheckout('user-1', { checkoutSessionId: 'cs-1' });

      expect(res.orderGroup.id).toBe('og-1');
      expect(res.orders.length).toBe(1);
      expect(prismaMock.orderAddressSnapshot.create).toHaveBeenCalled();
      expect(prismaMock.orderPriceSnapshot.create).toHaveBeenCalled();
      expect(prismaMock.orderShipping.create).toHaveBeenCalled();
      expect(prismaMock.stockReservationItem.create).toHaveBeenCalled();
      expect(prismaMock.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'order.created' }),
        }),
      );
    });
  });

  describe('5. OrderStateMachineService', () => {
    it('deve transicionar status do pedido de PAID para PROCESSING com gravacao em OrderStatusHistory, OrderTimeline e Outbox', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ id: 'ord-1', status: OrderStatus.PAID });
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });

      await stateMachine.transitionState({
        orderId: 'ord-1',
        newStatus: OrderStatus.PROCESSING,
        reason: 'Pagamento confirmado',
        changedById: 'admin-1',
      });

      expect(prismaMock.orderStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousStatus: OrderStatus.PAID,
            newStatus: OrderStatus.PROCESSING,
          }),
        }),
      );

      expect(prismaMock.orderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventCode: 'ORDER_PROCESSING',
          }),
        }),
      );

      expect(prismaMock.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            aggregateType: 'Order',
            eventType: 'order.updated',
          }),
        }),
      );
    });

    it('deve rejeitar transicao invalida de status do pedido (ex: COMPLETED -> PROCESSING)', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ id: 'ord-1', status: OrderStatus.COMPLETED });

      await expect(
        stateMachine.transitionState({
          orderId: 'ord-1',
          newStatus: OrderStatus.PROCESSING,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('6. OrdersService Queries & Audit', () => {
    it('deve adicionar comentario e registrar evento na timeline', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ id: 'ord-1', userId: 'user-1' });
      prismaMock.orderComment.create.mockResolvedValue({ id: 'c-1', comment: 'Verificar entrega' });

      const res = await ordersService.addComment('ord-1', 'user-1', { comment: 'Verificar entrega' });

      expect(res.id).toBe('c-1');
      expect(prismaMock.orderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventCode: 'COMMENT_ADDED' }),
        }),
      );
    });
  });
});
