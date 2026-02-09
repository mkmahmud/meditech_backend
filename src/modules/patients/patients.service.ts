import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EncryptionService } from '@/common/encryption/encryption.service';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  // Patient management methods will be implemented here
  async getPatientProfile(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            dateOfBirth: true,
            gender: true,
          },
        },
        medicalHistory: true,
        allergies: true,
      },
    });

    return patient;
  }
}
