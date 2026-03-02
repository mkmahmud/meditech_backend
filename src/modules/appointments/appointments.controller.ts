import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AppointmentsService } from "./appointments.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CreateAppointmentDTO, createAppointmentSchema } from "./schemas/appointments.schema";



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


    // Get Appointments by Doctor ID - Doctor only
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('DOCTOR')
    @Get('get-appointments-by-doctor-id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get appointments by doctor ID (Doctor only)' })
    @ApiResponse({ status: 200, description: 'Appointments retrieved successfully' })
    async getAppointmentsByDoctorId(

        @Param('doctorId') doctorId: string,
        @Param('date') date?: string,

    ) {

        return this.appointmentsService.getAppointmentsByDoctorId(doctorId, date);
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
        @Param('patientId') patientId: string,
    ) {
        return this.appointmentsService.getAppointmentsByPatientId(patientId);
    }


}
