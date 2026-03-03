import { PrismaService } from '../../common/prisma/prisma.service';
import { Injectable, NotFoundException } from "@nestjs/common";
import {
    CreateAppointmentDTO,
    CancelAppointmentDTO,
    CompleteAppointmentDTO
} from './schemas/appointments.schema';
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

        if (!doctorId) {
            throw new NotFoundException("Doctor ID is required");
        }

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
                patient: {
                    select: {
                        id: true,
                        bloodType: true,
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                profileImageUrl: true,
                                phoneNumber: true,
                                gender: true,
                                dateOfBirth: true,
                            }
                        }
                    }
                }
            }
        });

        return appointments;
    }


    // Get Appointments by Patient ID
    async getAppointmentsByPatientId(patientId: string) {
        if (!patientId) {
            throw new NotFoundException("Patient ID is required");
        }

        const appointments = await this.prisma.appointment.findMany({
            where: { patientId },
            include: {
                doctor: {
                    select: {
                        id: true,
                        specialization: true,
                        consultationFee: true,
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                profileImageUrl: true,
                            }
                        }
                    }
                },
                patient: {
                    select: {
                        id: true,
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                profileImageUrl: true,
                            }
                        }
                    }
                }
            }
        });
        return appointments;
    }


    // Cancel Appointment
    async cancelAppointment(data: CancelAppointmentDTO) {
        const { appointmentId, patientId, doctorId, cancellationReason } = data;
        const appointment = await this.prisma.appointment.findUnique({
            where: { id: appointmentId, patientId, doctorId },
        });

        if (!appointment) throw new NotFoundException("Appointment not found");

        return await this.prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: AppointmentStatus.CANCELLED, cancellationReason: cancellationReason, cancelledAt: new Date() },
        });
    }


    // Get Appointment Details by ID
    async getAppointmentDetailsById(appointmentId: string) {
        const appointment = await this.prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: {
                doctor: {
                    select: {
                        id: true,
                        specialization: true,
                        consultationFee: true,
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                profileImageUrl: true,
                                phoneNumber: true,
                                email: true,
                            }
                        }
                    }
                },
                patient: {
                    select: {
                        id: true,
                        bloodType: true,
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                profileImageUrl: true,
                                phoneNumber: true,
                                email: true,
                                dateOfBirth: true,
                                gender: true,
                            }
                        }
                    }
                }
            }
        });

        if (!appointment) throw new NotFoundException("Appointment not found");

        return appointment;
    }


    // Complete By Doctor - Doctor only
    async completeAppointmentByDoctor(data: CompleteAppointmentDTO) {
        const { appointmentId, doctorId, diagnosis, notes } = data;
        const appointment = await this.prisma.appointment.findUnique({
            where: { id: appointmentId, doctorId },
        });

        if (!appointment) throw new NotFoundException("Appointment not found");

        const updatedappointment = await this.prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: AppointmentStatus.COMPLETED, diagnosis, notes, updatedAt: new Date() },
        });

        return updatedappointment;
    }



}