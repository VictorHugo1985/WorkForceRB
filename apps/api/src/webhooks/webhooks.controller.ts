import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly secret = process.env.CROSSCHEX_WEBHOOK_SECRET ?? '';

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('crosschex')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Headers('authorize-sign') authorizeSign: string,
    @Headers('requestid') requestId: string,
    @Body() body: any,
  ) {
    if (!this.secret || authorizeSign !== this.secret) {
      this.logger.warn(`Rejected webhook: invalid authorize-sign`);
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const effectiveRequestId = requestId ?? body?.requestId ?? crypto.randomUUID();

    // Respond immediately so CrossChex doesn't retry; process async
    void this.webhooksService.processCrossChex(effectiveRequestId, body).catch((err) =>
      this.logger.error(`processCrossChex failed for ${effectiveRequestId}: ${(err as Error).message}`),
    );

    return { code: '200', msg: 'success' };
  }
}
