import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CustomerStatus, CustomerTagType, Channel } from '@prisma/client';

@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo cliente' })
  async create(@Body() data: {
    phone: string;
    name?: string;
    email?: string;
    dni?: string;
    status?: CustomerStatus;
    segment?: string;
    preferredChannel?: Channel;
    createdBy?: string;
  }) {
    return this.customersService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'Listar clientes con filtros' })
  async findAll(
    @Query('status') status?: CustomerStatus,
    @Query('segment') segment?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.customersService.findAll({
      status,
      segment,
      search,
      limit: limit ? parseInt(limit) : undefined,
      skip: skip ? parseInt(skip) : undefined,
    });
  }

  @Get('phone/:phone')
  @ApiOperation({ summary: 'Buscar cliente por teléfono' })
  async findByPhone(@Param('phone') phone: string) {
    return this.customersService.findByPhone(phone);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cliente por ID' })
  async findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Obtener estadísticas del cliente' })
  async getStats(@Param('id') id: string) {
    return this.customersService.getCustomerStats(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar cliente' })
  async update(
    @Param('id') id: string,
    @Body() data: {
      name?: string;
      email?: string;
      dni?: string;
      status?: CustomerStatus;
      segment?: string;
      preferredChannel?: Channel;
      updatedBy?: string;
    }
  ) {
    return this.customersService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar cliente (soft delete)' })
  async delete(@Param('id') id: string, @Query('deletedBy') deletedBy?: string) {
    return this.customersService.delete(id, deletedBy);
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Bloquear cliente' })
  async block(@Param('id') id: string, @Body() data: { blockedBy?: string }) {
    return this.customersService.block(id, data.blockedBy);
  }

  @Post(':id/tags')
  @ApiOperation({ summary: 'Agregar etiqueta a cliente' })
  async addTag(
    @Param('id') id: string,
    @Body() data: {
      type: CustomerTagType;
      label: string;
      description?: string;
      color?: string;
      createdBy?: string;
    }
  ) {
    return this.customersService.addTag(id, data);
  }

  @Delete(':id/tags/:tagId')
  @ApiOperation({ summary: 'Eliminar etiqueta de cliente' })
  async removeTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.customersService.removeTag(id, tagId);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Agregar nota a cliente' })
  async addNote(
    @Param('id') id: string,
    @Body() data: {
      title?: string;
      content: string;
      isInternal?: boolean;
      createdBy?: string;
    }
  ) {
    return this.customersService.addNote(id, data);
  }

  @Put('notes/:noteId')
  @ApiOperation({ summary: 'Actualizar nota' })
  async updateNote(
    @Param('noteId') noteId: string,
    @Body() data: { title?: string; content?: string }
  ) {
    return this.customersService.updateNote(noteId, data);
  }

  @Delete('notes/:noteId')
  @ApiOperation({ summary: 'Eliminar nota' })
  async deleteNote(@Param('noteId') noteId: string) {
    return this.customersService.deleteNote(noteId);
  }
}
