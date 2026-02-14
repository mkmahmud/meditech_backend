import { BadRequestException, Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public, Roles } from '@/common/decorators/auth.decorator';
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

  @Public()
  @Get('doctors')
  @ApiOperation({ summary: 'Get all Doctors ' })
  findDoctors() {
    return this.usersService.findDoctors();
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
