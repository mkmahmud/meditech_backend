import { PrismaService } from '../../common/prisma/prisma.service';
import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { Cron, CronExpression } from '@nestjs/schedule';
import {
    CreateAppointmentDTO,
    CancelAppointmentDTO,
    CompleteAppointmentDTO
} from './schemas/appointments.schema';
import { AppointmentStatus, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';


@Injectable()
export class AppointmentsService {
    private readonly logger = new Logger(AppointmentsService.name);

    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
    ) { }

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
                patient: {
                    select: {
                        userId: true,
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                },
                doctor: {
                    select: {
                        userId: true,
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                }
            }
        });

        // Send notification to patient
        try {
            await this.notificationsService.createNotification({
                userId: appointment.patient.userId,
                type: NotificationType.APPOINTMENT_REMINDER,
                title: 'Appointment Scheduled',
                message: `Your appointment with Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName} has been scheduled for ${new Date(appointment.scheduledAt).toLocaleString()}.`,
                data: JSON.stringify({
                    appointmentId: appointment.id,
                    doctorName: `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
                    scheduledAt: appointment.scheduledAt,
                }),
            });

            // Send notification to doctor
            await this.notificationsService.createNotification({
                userId: appointment.doctor.userId,
                type: NotificationType.APPOINTMENT_REMINDER,
                title: 'New Appointment',
                message: `New appointment scheduled with ${appointment.patient.user.firstName} ${appointment.patient.user.lastName} at ${new Date(appointment.scheduledAt).toLocaleString()}.`,
                data: JSON.stringify({
                    appointmentId: appointment.id,
                    patientName: `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`,
                    scheduledAt: appointment.scheduledAt,
                }),
            });

            this.logger.log(`Appointment creation notifications sent for appointment ${appointment.id}`);
        } catch (error) {
            this.logger.error(`Failed to send appointment creation notifications: ${error.message}`);
        }

        return appointment;
    }

    // Get Appointments by Doctor ID
    async getAppointmentsByDoctorId(doctorId: string, date?: string, download?: boolean) {

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

        if (download) {
            return appointments.map((appointment) => ({
                scheduledAt: appointment.scheduledAt,
                patientName: `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`.trim(),
                status: appointment.status,
            }));
        }

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
            include: {
                patient: {
                    select: {
                        userId: true,
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                },
                doctor: {
                    select: {
                        userId: true,
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                }
            }
        });

        if (!appointment) throw new NotFoundException("Appointment not found");

        const updatedAppointment = await this.prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: AppointmentStatus.CANCELLED, cancellationReason: cancellationReason, cancelledAt: new Date() },
        });

        // Send cancellation notification to both patient and doctor
        try {
            // Determine who cancelled (patient or doctor)
            const cancelledByDoctor = doctorId !== undefined;
            const cancelledByPatient = patientId !== undefined;

            // Notify patient
            await this.notificationsService.createNotification({
                userId: appointment.patient.userId,
                type: NotificationType.APPOINTMENT_REMINDER,
                title: 'Appointment Cancelled',
                message: cancelledByDoctor
                    ? `Your appointment with Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName} has been cancelled. Reason: ${cancellationReason || 'Not specified'}.`
                    : `You have cancelled your appointment scheduled for ${new Date(appointment.scheduledAt).toLocaleString()}.`,
                data: JSON.stringify({
                    appointmentId: appointment.id,
                    cancellationReason,
                    cancelledAt: new Date(),
                }),
            });

            // Notify doctor
            await this.notificationsService.createNotification({
                userId: appointment.doctor.userId,
                type: NotificationType.APPOINTMENT_REMINDER,
                title: 'Appointment Cancelled',
                message: cancelledByPatient
                    ? `${appointment.patient.user.firstName} ${appointment.patient.user.lastName} has cancelled their appointment scheduled for ${new Date(appointment.scheduledAt).toLocaleString()}.`
                    : `You have cancelled the appointment with ${appointment.patient.user.firstName} ${appointment.patient.user.lastName}.`,
                data: JSON.stringify({
                    appointmentId: appointment.id,
                    cancellationReason,
                    cancelledAt: new Date(),
                }),
            });

            this.logger.log(`Appointment cancellation notifications sent for appointment ${appointmentId}`);
        } catch (error) {
            this.logger.error(`Failed to send cancellation notifications: ${error.message}`);
        }

        return updatedAppointment;
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
            include: {
                patient: {
                    select: {
                        userId: true,
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                },
                doctor: {
                    select: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                }
            }
        });

        if (!appointment) throw new NotFoundException("Appointment not found");

        const updatedappointment = await this.prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: AppointmentStatus.COMPLETED, diagnosis, notes, updatedAt: new Date() },
        });

        // Send completion notification to patient
        try {
            await this.notificationsService.createNotification({
                userId: appointment.patient.userId,
                type: NotificationType.GENERAL,
                title: 'Appointment Completed',
                message: `Your appointment with Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName} has been completed. ${diagnosis ? 'Diagnosis and notes have been recorded.' : ''}`,
                data: JSON.stringify({
                    appointmentId: appointment.id,
                    diagnosis,
                    completedAt: new Date(),
                }),
            });

            this.logger.log(`Appointment completion notification sent for appointment ${appointmentId}`);
        } catch (error) {
            this.logger.error(`Failed to send completion notification: ${error.message}`);
        }

        return updatedappointment;
    }

    // Auto-cancel appointments that have passed scheduled time (runs every minute)
    @Cron(CronExpression.EVERY_MINUTE)
    async updateExpiredAppointments() {
        try {
            const now = new Date();

            const result = await this.prisma.appointment.updateMany({
                where: {
                    status: AppointmentStatus.SCHEDULED,
                    scheduledAt: {
                        lt: now,
                    },
                },
                data: {
                    status: AppointmentStatus.CANCELLED,
                    cancellationReason: 'Times Up',
                    cancelledAt: new Date(),
                    updatedAt: new Date(),
                },
            });

            if (result.count > 0) {
                this.logger.log(`Auto-cancelled ${result.count} expired appointments`);
            }
        } catch (error) {
            this.logger.error(`Error updating expired appointments: ${error.message}`);
        }
    }

    // Send appointment reminders (runs every hour)
    @Cron(CronExpression.EVERY_HOUR)
    async sendAppointmentReminders() {
        try {
            const now = new Date();
            const reminderWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

            // Find appointments scheduled in the next 24 hours
            const upcomingAppointments = await this.prisma.appointment.findMany({
                where: {
                    status: AppointmentStatus.SCHEDULED,
                    scheduledAt: {
                        gte: now,
                        lte: reminderWindow,
                    },
                },
                include: {
                    patient: {
                        select: {
                            userId: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                }
                            }
                        }
                    },
                    doctor: {
                        select: {
                            userId: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                }
                            }
                        }
                    }
                },
            });

            for (const appointment of upcomingAppointments) {
                const hoursUntilAppointment = Math.round(
                    (new Date(appointment.scheduledAt).getTime() - now.getTime()) / (1000 * 60 * 60)
                );

                // Check if we should send a reminder (e.g., 24 hours before)
                if (hoursUntilAppointment <= 24 && hoursUntilAppointment > 23) {
                    try {
                        // Send reminder to patient
                        await this.notificationsService.createNotification({
                            userId: appointment.patient.userId,
                            type: NotificationType.APPOINTMENT_REMINDER,
                            title: 'Appointment Reminder',
                            message: `Reminder: You have an appointment with Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName} tomorrow at ${new Date(appointment.scheduledAt).toLocaleTimeString()}.`,
                            data: JSON.stringify({
                                appointmentId: appointment.id,
                                scheduledAt: appointment.scheduledAt,
                                doctorName: `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
                            }),
                        });

                        // Send reminder to doctor
                        await this.notificationsService.createNotification({
                            userId: appointment.doctor.userId,
                            type: NotificationType.APPOINTMENT_REMINDER,
                            title: 'Appointment Reminder',
                            message: `Reminder: You have an appointment with ${appointment.patient.user.firstName} ${appointment.patient.user.lastName} tomorrow at ${new Date(appointment.scheduledAt).toLocaleTimeString()}.`,
                            data: JSON.stringify({
                                appointmentId: appointment.id,
                                scheduledAt: appointment.scheduledAt,
                                patientName: `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`,
                            }),
                        });

                        this.logger.log(`Reminder sent for appointment ${appointment.id}`);
                    } catch (error) {
                        this.logger.error(`Failed to send reminder for appointment ${appointment.id}: ${error.message}`);
                    }
                }
            }

            if (upcomingAppointments.length > 0) {
                this.logger.log(`Processed ${upcomingAppointments.length} upcoming appointments for reminders`);
            }
        } catch (error) {
            this.logger.error(`Error sending appointment reminders: ${error.message}`);
        }
    }

}
