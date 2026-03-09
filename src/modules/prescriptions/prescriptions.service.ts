import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
    CreatePrescriptionDto,
    UpdatePrescriptionDto,
    GetPrescriptionsDto,
    AddMedicationDto,
    UpdateMedicationDto,
    SendToPharmacyDto,
    SignPrescriptionDto,
} from './schemas/prescriptions.schema';
import { PrescriptionStatus, NotificationType } from '@prisma/client';

@Injectable()
export class PrescriptionsService {
    private readonly logger = new Logger(PrescriptionsService.name);

    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
    ) { }

    /**
     * Create a new prescription
     */
    async createPrescription(data: CreatePrescriptionDto) {
        // Verify doctor exists
        const doctor = await this.prisma.doctor.findUnique({
            where: { id: data.doctorId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!doctor) {
            throw new NotFoundException('Doctor not found');
        }

        // Verify patient exists
        const patient = await this.prisma.patient.findUnique({
            where: { id: data.patientId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!patient) {
            throw new NotFoundException('Patient not found');
        }

        // Create prescription with medications
        const prescription = await this.prisma.prescription.create({
            data: {
                patientId: data.patientId,
                doctorId: data.doctorId,
                status: PrescriptionStatus.ACTIVE,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
                notes: data.notes,
                medications: {
                    create: data.medications.map((med) => ({
                        medicationName: med.medicationName,
                        dosage: med.dosage,
                        frequency: med.frequency,
                        duration: med.duration,
                        instructions: med.instructions,
                        refillsAllowed: med.refillsAllowed || 0,
                        refillsUsed: 0,
                        checkedForInteractions: false,
                    })),
                },
            },
            include: {
                medications: true,
                patient: {
                    select: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
                doctor: {
                    select: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
        });

        // Send notification to patient
        try {
            await this.notificationsService.createNotification({
                userId: patient.user.id,
                type: NotificationType.PRESCRIPTION_REMINDER,
                title: 'New Prescription',
                message: `Dr. ${doctor.user.firstName} ${doctor.user.lastName} has prescribed ${prescription.medications.length} medication(s) for you.`,
                data: JSON.stringify({
                    prescriptionId: prescription.id,
                    doctorName: `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`,
                    medicationCount: prescription.medications.length,
                }),
            });

            this.logger.log(`Prescription notification sent to patient ${patient.user.id}`);
        } catch (error) {
            this.logger.error(`Failed to send prescription notification: ${error.message}`);
        }

        return prescription;
    }

    /**
     * Get prescriptions with filters
     */
    async getPrescriptions(query: GetPrescriptionsDto) {
        const { patientId, doctorId, status, limit, offset } = query;

        const where: any = {};

        if (patientId) {
            where.patientId = patientId;
        }

        if (doctorId) {
            where.doctorId = doctorId;
        }

        if (status) {
            where.status = status;
        }

        const [prescriptions, total] = await Promise.all([
            this.prisma.prescription.findMany({
                where,
                include: {
                    medications: true,
                    patient: {
                        select: {
                            id: true,
                            user: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    dateOfBirth: true,
                                },
                            },
                        },
                    },
                    doctor: {
                        select: {
                            id: true,
                            specialization: true,
                            user: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: Number(limit),
                skip: Number(offset),
            }),
            this.prisma.prescription.count({ where }),
        ]);

        return {
            data: prescriptions,
            total,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + prescriptions.length < total,
        };
    }

    /**
     * Get prescription by ID
     */
    async getPrescriptionById(id: string) {
        const prescription = await this.prisma.prescription.findUnique({
            where: { id },
            include: {
                medications: true,
                patient: {
                    select: {
                        id: true,
                        bloodType: true,
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                dateOfBirth: true,
                                phoneNumber: true,
                                email: true,
                            },
                        },
                        allergies: true,
                    },
                },
                doctor: {
                    select: {
                        id: true,
                        licenseNumber: true,
                        specialization: true,
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                phoneNumber: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        if (!prescription) {
            throw new NotFoundException('Prescription not found');
        }

        return prescription;
    }

    /**
     * Update prescription
     */
    async updatePrescription(id: string, data: UpdatePrescriptionDto) {
        const prescription = await this.prisma.prescription.findUnique({
            where: { id },
            include: {
                patient: {
                    select: {
                        user: { select: { id: true } },
                    },
                },
            },
        });

        if (!prescription) {
            throw new NotFoundException('Prescription not found');
        }

        const updated = await this.prisma.prescription.update({
            where: { id },
            data: {
                status: data.status as PrescriptionStatus,
                notes: data.notes,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
            },
            include: {
                medications: true,
            },
        });

        // Notify patient if status changed to CANCELLED or EXPIRED
        if (data.status && ['CANCELLED', 'EXPIRED'].includes(data.status)) {
            try {
                await this.notificationsService.createNotification({
                    userId: prescription.patient.user.id,
                    type: NotificationType.PRESCRIPTION_REMINDER,
                    title: `Prescription ${data.status}`,
                    message: `Your prescription has been ${data.status.toLowerCase()}.`,
                    data: JSON.stringify({
                        prescriptionId: prescription.id,
                        status: data.status,
                    }),
                });
            } catch (error) {
                this.logger.error(`Failed to send prescription status notification: ${error.message}`);
            }
        }

        this.logger.log(`Prescription ${id} updated`);
        return updated;
    }

    /**
     * Delete prescription
     */
    async deletePrescription(id: string) {
        const prescription = await this.prisma.prescription.findUnique({
            where: { id },
        });

        if (!prescription) {
            throw new NotFoundException('Prescription not found');
        }

        await this.prisma.prescription.delete({
            where: { id },
        });

        this.logger.log(`Prescription ${id} deleted`);
        return { message: 'Prescription deleted successfully' };
    }

    /**
     * Add medication to existing prescription
     */
    async addMedication(data: AddMedicationDto) {
        const prescription = await this.prisma.prescription.findUnique({
            where: { id: data.prescriptionId },
        });

        if (!prescription) {
            throw new NotFoundException('Prescription not found');
        }

        if (prescription.status !== PrescriptionStatus.ACTIVE) {
            throw new BadRequestException('Cannot add medication to inactive prescription');
        }

        const medication = await this.prisma.prescriptionMedication.create({
            data: {
                prescriptionId: data.prescriptionId,
                medicationName: data.medication.medicationName,
                dosage: data.medication.dosage,
                frequency: data.medication.frequency,
                duration: data.medication.duration,
                instructions: data.medication.instructions,
                refillsAllowed: data.medication.refillsAllowed || 0,
                refillsUsed: 0,
                checkedForInteractions: false,
            },
        });

        this.logger.log(`Medication added to prescription ${data.prescriptionId}`);
        return medication;
    }

    /**
     * Update medication
     */
    async updateMedication(data: UpdateMedicationDto) {
        const medication = await this.prisma.prescriptionMedication.findUnique({
            where: { id: data.medicationId },
        });

        if (!medication) {
            throw new NotFoundException('Medication not found');
        }

        const updated = await this.prisma.prescriptionMedication.update({
            where: { id: data.medicationId },
            data: {
                medicationName: data.medicationName,
                dosage: data.dosage,
                frequency: data.frequency,
                duration: data.duration,
                instructions: data.instructions,
                refillsAllowed: data.refillsAllowed,
            },
        });

        this.logger.log(`Medication ${data.medicationId} updated`);
        return updated;
    }

    /**
     * Delete medication
     */
    async deleteMedication(medicationId: string) {
        const medication = await this.prisma.prescriptionMedication.findUnique({
            where: { id: medicationId },
        });

        if (!medication) {
            throw new NotFoundException('Medication not found');
        }

        await this.prisma.prescriptionMedication.delete({
            where: { id: medicationId },
        });

        this.logger.log(`Medication ${medicationId} deleted`);
        return { message: 'Medication deleted successfully' };
    }

    /**
     * Refill medication
     */
    async refillMedication(medicationId: string) {
        const medication = await this.prisma.prescriptionMedication.findUnique({
            where: { id: medicationId },
            include: {
                prescription: {
                    include: {
                        patient: {
                            select: {
                                user: { select: { id: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!medication) {
            throw new NotFoundException('Medication not found');
        }

        if (medication.refillsUsed >= medication.refillsAllowed) {
            throw new BadRequestException('No refills remaining for this medication');
        }

        const updated = await this.prisma.prescriptionMedication.update({
            where: { id: medicationId },
            data: {
                refillsUsed: medication.refillsUsed + 1,
            },
        });

        // Notify patient about refill
        try {
            await this.notificationsService.createNotification({
                userId: medication.prescription.patient.user.id,
                type: NotificationType.PRESCRIPTION_REMINDER,
                title: 'Prescription Refilled',
                message: `Your medication "${medication.medicationName}" has been refilled. ${medication.refillsAllowed - medication.refillsUsed - 1} refills remaining.`,
                data: JSON.stringify({
                    medicationId,
                    medicationName: medication.medicationName,
                    refillsRemaining: medication.refillsAllowed - medication.refillsUsed - 1,
                }),
            });
        } catch (error) {
            this.logger.error(`Failed to send refill notification: ${error.message}`);
        }

        this.logger.log(`Medication ${medicationId} refilled`);
        return updated;
    }

    /**
     * Sign prescription (digital signature)
     */
    async signPrescription(data: SignPrescriptionDto) {
        const prescription = await this.prisma.prescription.findUnique({
            where: { id: data.prescriptionId },
        });

        if (!prescription) {
            throw new NotFoundException('Prescription not found');
        }

        if (prescription.doctorId !== data.doctorId) {
            throw new ForbiddenException('Only the prescribing doctor can sign this prescription');
        }

        if (prescription.doctorSignature) {
            throw new BadRequestException('Prescription is already signed');
        }

        const signed = await this.prisma.prescription.update({
            where: { id: data.prescriptionId },
            data: {
                doctorSignature: data.signature,
                signedAt: new Date(),
            },
            include: {
                medications: true,
            },
        });

        this.logger.log(`Prescription ${data.prescriptionId} signed by doctor ${data.doctorId}`);
        return signed;
    }

    /**
     * Send prescription to pharmacy
     */
    async sendToPharmacy(data: SendToPharmacyDto) {
        const prescription = await this.prisma.prescription.findUnique({
            where: { id: data.prescriptionId },
            include: {
                patient: {
                    select: {
                        user: { select: { id: true } },
                    },
                },
            },
        });

        if (!prescription) {
            throw new NotFoundException('Prescription not found');
        }

        if (!prescription.doctorSignature) {
            throw new BadRequestException('Prescription must be signed before sending to pharmacy');
        }

        if (prescription.sentToPharmacy) {
            throw new BadRequestException('Prescription has already been sent to pharmacy');
        }

        const updated = await this.prisma.prescription.update({
            where: { id: data.prescriptionId },
            data: {
                pharmacyId: data.pharmacyId,
                sentToPharmacy: true,
                sentAt: new Date(),
            },
        });

        // Notify patient
        try {
            await this.notificationsService.createNotification({
                userId: prescription.patient.user.id,
                type: NotificationType.PRESCRIPTION_REMINDER,
                title: 'Prescription Sent to Pharmacy',
                message: 'Your prescription has been sent to the pharmacy and is being prepared.',
                data: JSON.stringify({
                    prescriptionId: data.prescriptionId,
                    pharmacyId: data.pharmacyId,
                }),
            });
        } catch (error) {
            this.logger.error(`Failed to send pharmacy notification: ${error.message}`);
        }

        this.logger.log(`Prescription ${data.prescriptionId} sent to pharmacy ${data.pharmacyId}`);
        return updated;
    }

    /**
     * Cron job to mark expired prescriptions
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async markExpiredPrescriptions() {
        try {
            const now = new Date();

            const result = await this.prisma.prescription.updateMany({
                where: {
                    status: PrescriptionStatus.ACTIVE,
                    expiresAt: {
                        lt: now,
                    },
                },
                data: {
                    status: PrescriptionStatus.EXPIRED,
                },
            });

            if (result.count > 0) {
                this.logger.log(`Marked ${result.count} prescriptions as expired`);
            }
        } catch (error) {
            this.logger.error(`Error marking expired prescriptions: ${error.message}`);
        }
    }

    /**
     * Cron job to send refill reminders
     */
    @Cron(CronExpression.EVERY_DAY_AT_10AM)
    async sendRefillReminders() {
        try {
            // Find active prescriptions with medications that have refills remaining
            const prescriptions = await this.prisma.prescription.findMany({
                where: {
                    status: PrescriptionStatus.ACTIVE,
                    medications: {
                        some: {
                            refillsUsed: {
                                lt: this.prisma.prescriptionMedication.fields.refillsAllowed,
                            },
                        },
                    },
                },
                include: {
                    medications: {
                        where: {
                            refillsUsed: {
                                lt: this.prisma.prescriptionMedication.fields.refillsAllowed,
                            },
                        },
                    },
                    patient: {
                        select: {
                            user: { select: { id: true } },
                        },
                    },
                },
            });

            for (const prescription of prescriptions) {
                if (prescription.medications.length > 0) {
                    try {
                        await this.notificationsService.createNotification({
                            userId: prescription.patient.user.id,
                            type: NotificationType.PRESCRIPTION_REMINDER,
                            title: 'Prescription Refill Available',
                            message: `You have ${prescription.medications.length} medication(s) with refills available.`,
                            data: JSON.stringify({
                                prescriptionId: prescription.id,
                                medicationsWithRefills: prescription.medications.length,
                            }),
                        });
                    } catch (error) {
                        this.logger.error(`Failed to send refill reminder for prescription ${prescription.id}: ${error.message}`);
                    }
                }
            }

            this.logger.log(`Sent refill reminders for ${prescriptions.length} prescriptions`);
        } catch (error) {
            this.logger.error(`Error sending refill reminders: ${error.message}`);
        }
    }
}
