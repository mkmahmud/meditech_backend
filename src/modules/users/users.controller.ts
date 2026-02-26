import { BadRequestException, Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public, Roles } from '../../common/decorators/auth.decorator';

import { UserRole } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  findAll() {
    return this.usersService.findAll();
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
