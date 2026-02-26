import { Injectable } from '@nestjs/common';
// import { PrismaService } from '@/common/prisma/prisma.service';
import { PrismaService } from '../../common/prisma/prisma.service';
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
  async findDoctors({ specialization, name, days, page = 1, limit = 10 }: { specialization?: string; name?: string; days?: string | string[]; page?: number; limit?: number }) {
    const skip = (page - 1) * limit;

    // Parse days - handle both array and string formats
    let dayArray: number[] | undefined;
    if (days) {
      if (Array.isArray(days)) {
        dayArray = days.map(d => parseInt(d)).filter(d => !isNaN(d));
      } else if (typeof days === 'string') {
        dayArray = days.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
      }
    }

    const where = {
      role: UserRole.DOCTOR,
      ...(specialization && { doctor: { is: { specialization: { equals: specialization } } } }),
      ...(name && { firstName: { contains: name, mode: 'insensitive' } }),
      ...(dayArray && dayArray.length > 0 && { doctor: { is: { availability: { some: { dayOfWeek: { in: dayArray } } } } } }),
    };

    // Get total count before pagination
    // @ts-ignore
    const total = await this.prisma.user.count({ where });

    const data = await this.prisma.user.findMany({
      // @ts-ignore
      where,
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
      },
      skip,
      take: limit,
    });

    // Return data with pagination metadata
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      }
    };
  }

  // Find Single Doctor by ID
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
