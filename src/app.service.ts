import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return { status: 'ok', service: 'quickcart-api', time: new Date().toISOString() };
  }
}
