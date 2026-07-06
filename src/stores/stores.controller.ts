import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { StoresService } from './stores.service';
import { ListStoresDto } from './dto/list-stores.dto';
import { ProductQueryDto } from './dto/product-query.dto';

// Public browsing endpoints — no auth required.
// Works across all verticals: /stores?vertical=FOOD | GROCERY | SHOP
@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  list(@Query() query: ListStoresDto) {
    return this.stores.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.stores.findOne(id);
  }

  @Get(':id/products')
  getProducts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProductQueryDto,
  ) {
    return this.stores.getProducts(id, query);
  }
}
