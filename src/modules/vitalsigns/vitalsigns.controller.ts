import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VitalsignsService } from './vitalsigns.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '@/common/decorators/auth.decorator';

@ApiTags('Vitalsigns')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('vitalsigns')
export class VitalsignsController {
    constructor(private readonly vitalsignsService: VitalsignsService) { }


    // Cretate a new vital sign record for a patient
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR')
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create new vital sign (Doctor only)' })
    @ApiResponse({ status: 201, description: 'Vital sign created successfully' })
    @ApiResponse({ status: 404, description: 'Doctor or patient not found' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @Post()
    async createVitalSign(@Body() vitalSignData: any) {
        const { patientId } = vitalSignData;
        return this.vitalsignsService.createVitalSign(patientId, vitalSignData);
    }


}
