import { PrismaService } from '../../common/prisma/prisma.service';
import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateAppointmentDTO } from './schemas/appointments.schema';
import { AppointmentStatus } from '@prisma/client';


@Injectable()
export class AppointmentsService {
    constructor(private prisma: PrismaService) { }

    // Create Appointment
    async createAppointment(data: CreateAppointmentDTO) {


        // Check if doctor exists
        const { doctorId } = data;

        const doctor = await this.prisma.doctor.findUnique({
            where: { id: doctorId },
        });

        if (!doctor) throw new NotFoundException("Doctor not found");

        const appointment = await this.prisma.appointment.create({
            data: {
                doctorId,
                patientId: data.patientId,
                scheduledAt: data.scheduledAt,
                type: data.type,
                duration: data.duration,
                status: AppointmentStatus.SCHEDULED,
                chiefComplaint: data.chiefComplaint,
            },

            select: {
                id: true,
                scheduledAt: true,
                type: true,
                duration: true,
                chiefComplaint: true,
                status: true,
            }
        });


        return appointment;
    }

    // Get Appointments by Doctor ID
    async getAppointmentsByDoctorId(doctorId: string, date?: string) {
        const appointments = await this.prisma.appointment.findMany({
            where: {
                doctorId,
                scheduledAt: date ? { gte: new Date(date), lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)) } : undefined,
            },
            select: {
                id: true,
                patientId: true,
                scheduledAt: true,
                type: true,
                duration: true,
                chiefComplaint: true,
                status: true,
            }
        });

        return appointments;
    }


    // Get Appointments by Patient ID
    async getAppointmentsByPatientId(patientId: string) {
        const appointments = await this.prisma.appointment.findMany({
            where: { patientId },
            select: {
                id: true,
                doctorId: true,
                scheduledAt: true,
                type: true,
                duration: true,
                chiefComplaint: true,
                status: true,
            }
        });
        return appointments;
    }


}