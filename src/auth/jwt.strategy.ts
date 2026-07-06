import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../../generated/prisma';

export interface JwtPayload {
  sub: string;
  phone: string;
  role: Role;
}

export interface AuthUser {
  id: string;
  phone: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }
    return { id: payload.sub, phone: payload.phone, role: payload.role };
  }
}
