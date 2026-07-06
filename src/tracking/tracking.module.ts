import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SimulationService } from './simulation.service';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [SimulationService, TrackingGateway],
  exports: [SimulationService],
})
export class TrackingModule {}
