import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import {
    createPrescriptionSchema,
    updatePrescriptionSchema,
    getPrescriptionsSchema,
    addMedicationSchema,
    updateMedicationSchema,
    refillMedicationSchema,
    sendToPharmacySchema,
    signPrescriptionSchema,
    CreatePrescriptionDto,
    UpdatePrescriptionDto,
    GetPrescriptionsDto,
    AddMedicationDto,
    UpdateMedicationDto,
    SendToPharmacyDto,
    SignPrescriptionDto,
} from './schemas/prescriptions.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/auth.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('Prescriptions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('prescriptions')
export class PrescriptionsController {
    constructor(private readonly prescriptionsService: PrescriptionsService) { }

    /**
     * Create a new prescription (Doctor only)
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR')
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create new prescription (Doctor only)' })
    @ApiResponse({ status: 201, description: 'Prescription created successfully' })
    @ApiResponse({ status: 404, description: 'Doctor or patient not found' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @UsePipes(new ZodValidationPipe(createPrescriptionSchema))
    async createPrescription(
        @Body() createPrescriptionDto: CreatePrescriptionDto,
    ) {
        return this.prescriptionsService.createPrescription(createPrescriptionDto);
    }

    /**
     * Get prescriptions with filters
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR', 'PATIENT', 'NURSE', 'PHARMACIST', 'ADMIN')
    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get prescriptions with filters' })
    @ApiResponse({ status: 200, description: 'Prescriptions retrieved successfully' })
    async getPrescriptions(
        @Query(new ZodValidationPipe(getPrescriptionsSchema))
        query: GetPrescriptionsDto,
    ) {
        return this.prescriptionsService.getPrescriptions(query);
    }

    /**
     * Get prescription by ID
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR', 'PATIENT', 'NURSE', 'PHARMACIST', 'ADMIN')
    @Get(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get prescription by ID' })
    @ApiResponse({ status: 200, description: 'Prescription retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Prescription not found' })
    async getPrescriptionById(@Param('id') id: string) {
        return this.prescriptionsService.getPrescriptionById(id);
    }

    /**
     * Update prescription (Doctor only)
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR')
    @Put(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update prescription (Doctor only)' })
    @ApiResponse({ status: 200, description: 'Prescription updated successfully' })
    @ApiResponse({ status: 404, description: 'Prescription not found' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @UsePipes(new ZodValidationPipe(updatePrescriptionSchema))
    async updatePrescription(
        @Param('id') id: string,
        @Body() updatePrescriptionDto: UpdatePrescriptionDto,
    ) {
        return this.prescriptionsService.updatePrescription(id, updatePrescriptionDto);
    }

    /**
     * Delete prescription (Doctor/Admin only)
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR', 'ADMIN')
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete prescription (Doctor/Admin only)' })
    @ApiResponse({ status: 200, description: 'Prescription deleted successfully' })
    @ApiResponse({ status: 404, description: 'Prescription not found' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    async deletePrescription(@Param('id') id: string) {
        return this.prescriptionsService.deletePrescription(id);
    }

    /**
     * Add medication to prescription (Doctor only)
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR')
    @Post('medications/add')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Add medication to prescription (Doctor only)' })
    @ApiResponse({ status: 201, description: 'Medication added successfully' })
    @ApiResponse({ status: 404, description: 'Prescription not found' })
    @ApiResponse({ status: 400, description: 'Cannot add to inactive prescription' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @UsePipes(new ZodValidationPipe(addMedicationSchema))
    async addMedication(@Body() addMedicationDto: AddMedicationDto) {
        return this.prescriptionsService.addMedication(addMedicationDto);
    }

    /**
     * Update medication (Doctor only)
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR')
    @Put('medications/:medicationId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update medication (Doctor only)' })
    @ApiResponse({ status: 200, description: 'Medication updated successfully' })
    @ApiResponse({ status: 404, description: 'Medication not found' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @UsePipes(new ZodValidationPipe(updateMedicationSchema))
    async updateMedication(
        @Param('medicationId') medicationId: string,
        @Body() updateMedicationDto: UpdateMedicationDto,
    ) {
        return this.prescriptionsService.updateMedication({
            ...updateMedicationDto,
            medicationId,
        });
    }

    /**
     * Delete medication (Doctor only)
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR')
    @Delete('medications/:medicationId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete medication (Doctor only)' })
    @ApiResponse({ status: 200, description: 'Medication deleted successfully' })
    @ApiResponse({ status: 404, description: 'Medication not found' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    async deleteMedication(@Param('medicationId') medicationId: string) {
        return this.prescriptionsService.deleteMedication(medicationId);
    }

    /**
     * Refill medication (Pharmacist/Doctor)
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('PHARMACIST', 'DOCTOR')
    @Post('medications/:medicationId/refill')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refill medication (Pharmacist/Doctor)' })
    @ApiResponse({ status: 200, description: 'Medication refilled successfully' })
    @ApiResponse({ status: 404, description: 'Medication not found' })
    @ApiResponse({ status: 400, description: 'No refills remaining' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    async refillMedication(@Param('medicationId') medicationId: string) {
        return this.prescriptionsService.refillMedication(medicationId);
    }

    /**
     * Sign prescription (Doctor only)
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR')
    @Post(':id/sign')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Digitally sign prescription (Doctor only)' })
    @ApiResponse({ status: 200, description: 'Prescription signed successfully' })
    @ApiResponse({ status: 404, description: 'Prescription not found' })
    @ApiResponse({ status: 403, description: 'Only prescribing doctor can sign' })
    @ApiResponse({ status: 400, description: 'Already signed' })
    @UsePipes(new ZodValidationPipe(signPrescriptionSchema))
    async signPrescription(@Body() signPrescriptionDto: SignPrescriptionDto) {
        return this.prescriptionsService.signPrescription(signPrescriptionDto);
    }

    /**
     * Send prescription to pharmacy (Doctor/Pharmacist)
     */
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR', 'PHARMACIST')
    @Post(':id/send-to-pharmacy')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Send prescription to pharmacy (Doctor/Pharmacist)',
    })
    @ApiResponse({
        status: 200,
        description: 'Prescription sent to pharmacy successfully',
    })
    @ApiResponse({ status: 404, description: 'Prescription not found' })
    @ApiResponse({ status: 400, description: 'Must be signed first or already sent' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @UsePipes(new ZodValidationPipe(sendToPharmacySchema))
    async sendToPharmacy(@Body() sendToPharmacyDto: SendToPharmacyDto) {
        return this.prescriptionsService.sendToPharmacy(sendToPharmacyDto);
    }
}
