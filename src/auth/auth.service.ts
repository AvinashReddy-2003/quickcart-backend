import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Role } from '../../generated/prisma';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private otpKey(phone: string) {
    return `otp:${phone}`;
  }

  /**
   * Generate a 6-digit OTP, store it in Redis with a TTL.
   * In development we return the code directly (no SMS provider wired yet).
   */
  async requestOtp(phone: string): Promise<{ message: string; devCode?: string }> {
    const code = randomInt(100000, 1000000).toString();
    const ttl = Number(this.config.get('OTP_TTL_SECONDS') ?? 300);
    await this.redis.setWithTtl(this.otpKey(phone), code, ttl);

    const isDev = this.config.get('NODE_ENV') !== 'production';
    // TODO(phase 6): send via SMS provider (MSG91/Twilio) in production.
    return {
      message: 'OTP sent',
      ...(isDev ? { devCode: code } : {}),
    };
  }

  async verifyOtp(phone: string, code: string, role?: Role) {
    const stored = await this.redis.get(this.otpKey(phone));
    if (!stored || stored !== code) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    await this.redis.del(this.otpKey(phone));

    // Roles are self-serviceable only for customer/vendor/rider signup.
    if (role === Role.ADMIN) {
      throw new ForbiddenException('ADMIN role cannot be self-assigned');
    }

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, role: role ?? Role.CUSTOMER },
    });

    return this.issueTokens({ sub: user.id, phone: user.phone, role: user.role });
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.issueTokens({ sub: user.id, phone: user.phone, role: user.role });
  }

  private async issueTokens(payload: JwtPayload) {
    const accessExpires = (this.config.get<string>('JWT_ACCESS_EXPIRES') ??
      '15m') as JwtSignOptions['expiresIn'];
    const refreshExpires = (this.config.get<string>('JWT_REFRESH_EXPIRES') ??
      '7d') as JwtSignOptions['expiresIn'];

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpires,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpires,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      user: { id: payload.sub, phone: payload.phone, role: payload.role },
    };
  }
}
