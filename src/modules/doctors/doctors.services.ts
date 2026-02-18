import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class doctorsService {
    constructor(private prisma: PrismaService) { }


    // Get Doctors Availability
    async getDoctorsAvailability(doctorId: string) {

        // Check if doctor exists
        const doctorExists = await this.prisma.user.findUnique({
            where: { id: doctorId },
            include: { doctor: true }
        });

        if (!doctorExists) {
            throw new NotFoundException('DOCTOR_NOT_FOUND');
        }

        // Find and return 
        const doctor = await this.prisma.doctorAvailability.findMany({
            where: { doctorId: doctorExists?.doctor?.id },
            select: {
                id: true,
                doctorId: true,
                dayOfWeek: true,
                startTime: true,
                isAvailable: true,
                endTime: true,
            }
        });

        return doctor;
    }

    // Create Doctor Availability
    async createDoctorAvailability(doctorId: string, availabilityData: any[]) {
        // Check doctor
        const doctor = await this.prisma.user.findUnique({
            where: { id: doctorId },
            include: { doctor: true }
        });

        if (!doctor || doctor.role !== 'DOCTOR' || !doctor.doctor) {
            throw new NotFoundException('DOCTOR_PROFILE_NOT_FOUND');
        }

        const doctorProfileId = doctor.doctor.id;

        // Execute as a Transaction (Atomicity)
        return this.prisma.$transaction(async (tx) => {

            // Delete existing records first
            await tx.doctorAvailability.deleteMany({
                where: { doctorId: doctorProfileId }
            });

            // Prepare the data  
            const recordsToCreate = availabilityData.map((slot) => ({
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                isAvailable: slot.isAvailable ?? true,
                doctorId: doctorProfileId,
            }));

            // Bulk insert
            const result = await tx.doctorAvailability.createMany({
                data: recordsToCreate,
            });

            return {
                count: result.count,
                message: 'AVAILABILITY_UPDATED_SUCCESSFULLY',
            };
        });
    }
}