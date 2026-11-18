import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { LiquidacionesModule } from './liquidaciones/liquidaciones.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    PrismaModule,
    AuthModule,
    WebhooksModule,
    LiquidacionesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
