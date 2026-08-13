import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { MailModule } from './modules/mail/mail.module';
import { StorageModule } from './modules/storage/storage.module';
import { AuditModule } from './modules/audit/audit.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

// Sprint 2 Modules
import { SellerProfilesModule } from './modules/seller-profiles/seller-profiles.module';
import { SellerDocumentsModule } from './modules/seller-documents/seller-documents.module';
import { StoresModule } from './modules/stores/stores.module';
import { StoreMembersModule } from './modules/store-members/store-members.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BrandsModule } from './modules/brands/brands.module';
import { ProductsModule } from './modules/products/products.module';
import { ProductImagesModule } from './modules/product-images/product-images.module';
import { ProductVariantsModule } from './modules/product-variants/product-variants.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { InventoryModule } from './modules/inventory/inventory.module';

// Sprint 3 Modules
import { AddressesModule } from './modules/addresses/addresses.module';
import { CartsModule } from './modules/carts/carts.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { ShippingQuotesModule } from './modules/shipping-quotes/shipping-quotes.module';
import { EstimatedTaxModule } from './modules/estimated-tax/estimated-tax.module';
import { InventoryAvailabilityModule } from './modules/inventory-availability/inventory-availability.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { OrdersModule } from './modules/orders/orders.module';
import { StockReservationsModule } from './modules/stock-reservations/stock-reservations.module';

// Sprint 4 Financial Infrastructure Modules
import { LedgerModule } from './modules/ledger/ledger.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { FinancialReconciliationModule } from './modules/financial-reconciliation/financial-reconciliation.module';
import { SettlementsModule } from './modules/settlements/settlements.module';

// Sprint 5.1 Logistics Foundation Module
import { LogisticsModule } from './modules/logistics/logistics.module';

// Sprint 5.2 Fulfillment Module
import { FulfillmentModule } from './modules/fulfillment/fulfillment.module';

import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string>('redis.password') || undefined,
        },
      }),
    }),
    CommonModule,
    PrismaModule,
    RedisModule,
    MailModule,
    StorageModule,
    AuditModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    AuthModule,
    HealthModule,

    // Sprint 2 Modules
    SellerProfilesModule,
    SellerDocumentsModule,
    StoresModule,
    StoreMembersModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    ProductImagesModule,
    ProductVariantsModule,
    WarehousesModule,
    InventoryModule,

    // Sprint 3 Modules
    AddressesModule,
    CartsModule,
    CouponsModule,
    ShippingQuotesModule,
    EstimatedTaxModule,
    InventoryAvailabilityModule,
    IdempotencyModule,
    CheckoutModule,
    OrdersModule,
    StockReservationsModule,

    // Sprint 4 Financial Infrastructure Modules
    LedgerModule,
    WalletModule,
    OutboxModule,
    EscrowModule,
    PayoutsModule,
    RefundsModule,
    WebhooksModule,
    PaymentsModule,
    FinancialReconciliationModule,
    SettlementsModule,

    // Sprint 5.1 Logistics Foundation Module
    LogisticsModule,

    // Sprint 5.2 Fulfillment Module
    FulfillmentModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, LoggerMiddleware).forRoutes('*');
  }
}
