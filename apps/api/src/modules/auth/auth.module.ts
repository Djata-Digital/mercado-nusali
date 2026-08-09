import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { RedisThrottlerStorage } from '../redis/redis-throttler-storage.service';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret', 'super-secret-jwt-key-change-in-production-min-32-chars'),
        signOptions: {
          expiresIn: configService.get<any>('jwt.expiresIn', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [],
      useFactory: (redisThrottlerStorage: RedisThrottlerStorage) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000,
            limit: 20,
          },
        ],
        storage: redisThrottlerStorage,
      }),
      inject: [RedisThrottlerStorage],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
