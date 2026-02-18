import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { doctorsService } from './doctors.services';
import { Public, Roles } from '@/common/decorators/auth.decorator';
import { UserRole } from '@prisma/client';


@ApiTags('Doctors')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('doctors')
export class DoctorsController {
    constructor(private readonly doctorsService: doctorsService) { }

    // Get Doctors Availability
    @Public()
    @Get(':id/availability')
    @ApiOperation({ summary: 'Get doctor availability' })
    async getDoctorsAvailability(@Param('id') doctorId: string) {
        return this.doctorsService.getDoctorsAvailability(doctorId);
    }


    // Create Doctor Availability
    @Post(':id/availability')
    @Roles(UserRole.ADMIN, UserRole.DOCTOR)
    @ApiOperation({ summary: 'Create doctor availability' })
    async createDoctorAvailability(
        @Param('id') doctorId: string,
        @Body() availabilityData: any,
    ) {
        return this.doctorsService.createDoctorAvailability(doctorId, availabilityData);
    }

}
