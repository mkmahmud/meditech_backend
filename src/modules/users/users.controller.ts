import { BadRequestException, Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public, Roles } from '../../common/decorators/auth.decorator';

import { UserRole, UserStatus } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // Get All Users with filtering, pagination, and sorting (Admin only)
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  findAll(
    @Query('search') search?: string,
    @Query('username') username?: string,
    @Query('email') email?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('fields') fields?: string,
    @Query('sortBy') sortBy: string = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.usersService.findAll({
      search,
      username,
      email,
      role,
      status,
      createdFrom,
      createdTo,
      includeDeleted: includeDeleted === 'true',
      fields,
      sortBy,
      sortOrder,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  // Update User Status (Admin only)
  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user status (Admin only)' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
  ) {
    const result = await this.usersService.updateStatus(id, status);
    return {
      message: 'User status updated successfully',
      ...result,
    };
  }

  // soft delete user (Admin only)
  @Patch(':id/delete')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft delete user (Admin only)' })
  async softDelete(@Param('id') id: string) {
    const result = await this.usersService.softDelete(id);
    return {
      message: 'User soft deleted successfully',
      ...result,
    };
  }

  // Get all Doctors with filtering and pagination
  @Public()
  @Get('doctors')
  @ApiOperation({ summary: 'Get all Doctors' })
  findDoctors(
    @Query('specialization') specialization?: string,
    @Query('name') name?: string,
    @Query('days') days?: string[],
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // Validate days if provided (should be numbers: 0-6)
    if (days && Array.isArray(days)) {
      const dayArray = days.map(d => parseInt(d));
      if (dayArray.some(d => isNaN(d) || d < 0 || d > 6)) {
        throw new BadRequestException('Days must be 0-6 (0=Sunday, 6=Saturday): ?days=2&days=3&days=4');
      }
    }

    return this.usersService.findDoctors({
      specialization,
      name,
      days,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // Update User Profile 

  @Patch('profile')
  async updateProfile(
    @Req() req: any,
    @Body() updateData: any,
  ) {
    const userId = req.user.id;

    if (!userId) {
      throw new BadRequestException('USER_IDENTITY_NOT_FOUND');
    }

    // This calls your service: this.prisma.user.update(...)
    return this.usersService.updateProfile(userId, updateData);
  }
}
