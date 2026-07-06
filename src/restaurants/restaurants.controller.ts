import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { ListRestaurantsDto } from './dto/list-restaurants.dto';
import { MenuQueryDto } from './dto/menu-query.dto';

// Public browsing endpoints — no auth required (Phase 1: browse, no ordering).
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurants: RestaurantsService) {}

  @Get()
  list(@Query() query: ListRestaurantsDto) {
    return this.restaurants.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.restaurants.findOne(id);
  }

  @Get(':id/menu')
  getMenu(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MenuQueryDto,
  ) {
    return this.restaurants.getMenu(id, query);
  }
}
