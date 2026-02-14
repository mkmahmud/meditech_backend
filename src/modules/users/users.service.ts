import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findAll() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  // Find Doctors
  async findDoctors() {
    return this.prisma.user.findMany({
      where: {
        role: UserRole.DOCTOR
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        doctor: {
          select: {
            specialization: true,
            experience: true,
            consultationFee: true,
          }
        }
      }
    })
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        dateOfBirth: true,
        gender: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Update Profile  
  async updateProfile(userId: string, data: any) {
    const { doctor, patient, ...userData } = data;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...userData,
        ...(doctor && {
          doctor: {
            update: {
              ...doctor,
              experience: doctor.experience ? Number(doctor.experience) : undefined,
              consultationFee: doctor.consultationFee ? Number(doctor.consultationFee) : undefined,
            }
          }
        }),
        ...(patient && {
          patient: {
            update: {
              ...patient
            }
          }
        })
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        status: true,
        profileImageUrl: true,
        doctor: true,
        patient: true,
      }
    });
  }

}
