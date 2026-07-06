import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';
import { Role } from '../../generated/prisma';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // The Phase 0 milestone: a protected endpoint. Any authenticated user.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.users.findById(user.id);
  }

  // Proves role-based access control: admins only.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.users.findAll();
  }
}
