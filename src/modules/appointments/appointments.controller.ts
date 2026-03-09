import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AppointmentsService } from "./appointments.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
    CreateAppointmentDTO,
    createAppointmentSchema,
    GetAppointmentsByDoctorIdDTO,
    getAppointmentsByDoctorIdSchema,
    GetAppointmentsByPatientIdDTO,
    getAppointmentsByPatientIdSchema,
    CancelAppointmentDTO,
    cancelAppointmentSchema,
    GetAppointmentDetailsByIdDTO,
    getAppointmentDetailsByIdSchema,
    CompleteAppointmentDTO,
    completeAppointmentSchema,
    ConfirmAppointemntDto,
    confirmAppointmentBypatient
} from "./schemas/appointments.schema";



@ApiTags('Appointments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {

    constructor(private readonly appointmentsService: AppointmentsService) { }

    // Create Appointment -  Patient  only
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('PATIENT')
    @Post('create-appointment')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create new appointment (Patient only)' })
    @ApiResponse({ status: 201, description: 'Appointment created successfully' })
    @ApiResponse({ status: 409, description: 'Appointment already exists' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    async createAppointment(
        @Body(new ZodValidationPipe(createAppointmentSchema)) createAppointmentDto: CreateAppointmentDTO,
    ) {
        return this.appointmentsService.createAppointment(createAppointmentDto);
    }

    // Update Appointment schedule to confirm  - Patient only
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('PATIENT')
    @Patch('confirm-appointment')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Confirm an appointment (Patient only)' })
    @ApiResponse({ status: 200, description: 'Appointment confirmed successfully' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    async confirmAppointment(
        @Body(new ZodValidationPipe(confirmAppointmentBypatient)) confirmAppointmentDto: ConfirmAppointemntDto,
    ) {
        return this.appointmentsService.confirmAppointment(confirmAppointmentDto.appointmentId);
    }


    // Get Appointments by Doctor ID - Doctor only
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR')
    @Get('get-appointments-by-doctor-id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get appointments by doctor ID (Doctor only)' })
    @ApiResponse({ status: 200, description: 'Appointments retrieved successfully' })
    async getAppointmentsByDoctorId(
        @Query(new ZodValidationPipe(getAppointmentsByDoctorIdSchema)) query: GetAppointmentsByDoctorIdDTO,
    ) {
        return this.appointmentsService.getAppointmentsByDoctorId(query.doctorId, query.date, query.download);
    }

    // Get Appointments by Patient ID - Patient only
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('PATIENT')
    @Get('get-appointments-by-patient-id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get appointments by patient ID (Patient only)' })
    @ApiResponse({ status: 200, description: 'Appointments retrieved successfully' })
    async getAppointmentsByPatientId(
        @Query(new ZodValidationPipe(getAppointmentsByPatientIdSchema)) query: GetAppointmentsByPatientIdDTO,
    ) {
        return this.appointmentsService.getAppointmentsByPatientId(query.patientId);
    }

    // Cancel Appointment - Doctor and Patient
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR', 'PATIENT')
    @Post('cancel-appointment')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cancel an appointment (Doctor and Patient)' })
    @ApiResponse({ status: 200, description: 'Appointment cancelled successfully' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    async cancelAppointment(
        @Body(new ZodValidationPipe(cancelAppointmentSchema)) cancelAppointmentDto: CancelAppointmentDTO,
    ) {
        return this.appointmentsService.cancelAppointment(cancelAppointmentDto);
    }


    // Get Appointment Details - Doctor and Patient
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR', 'PATIENT')
    @Get('get-appointment-details/:appointmentId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get appointment details (Doctor and Patient)' })
    @ApiResponse({ status: 200, description: 'Appointment details retrieved successfully' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    async getAppointmentDetailsById(
        @Param(new ZodValidationPipe(getAppointmentDetailsByIdSchema)) params: GetAppointmentDetailsByIdDTO,
    ) {
        return this.appointmentsService.getAppointmentDetailsById(params.appointmentId);
    }

    // Complete Appointment - Doctor only
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR')
    @Post('complete-appointment')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Complete an appointment (Doctor only)' })
    @ApiResponse({ status: 200, description: 'Appointment marked as completed successfully' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    async completeAppointment(
        @Body(new ZodValidationPipe(completeAppointmentSchema)) completeAppointmentDto: CompleteAppointmentDTO,
    ) {
        return this.appointmentsService.completeAppointmentByDoctor(completeAppointmentDto);
    }

}
