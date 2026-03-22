import { Injectable, Inject, forwardRef, ConflictException } from '@nestjs/common';
// import { PrismaService } from '@/common/prisma/prisma.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) { }

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
    const { doctor, patient, email, password, ...userData } = data;

    // Helper function to clean data - remove null, undefined, and empty strings
    const cleanData = (obj: any) => {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
          cleaned[key] = obj[key];
        }
      }
      return cleaned;
    };

    // Clean user data
    const cleanedUserData = cleanData(userData);

    // If only username is being updated (no doctor/patient/email/password/other fields)
    if (
      Object.keys(cleanedUserData).length === 1 &&
      Object.prototype.hasOwnProperty.call(cleanedUserData, 'username')
    ) {
      const usernameKey = `username:${cleanedUserData.username}`;
      // Try Redis first
      let existingUserId = await this.redisService.get<string>(usernameKey);
      if (!existingUserId) {
        // Not in cache, check DB
        const existingUser = await this.prisma.user.findUnique({
          where: { username: cleanedUserData.username },
          select: { id: true },
        });
        if (existingUser) {
          existingUserId = existingUser.id;
          // Cache for future
          await this.redisService.set(usernameKey, existingUserId, 60 * 5); // cache 5 min
        }
      }
      if (existingUserId && existingUserId !== userId) {
        throw new ConflictException('Username already exists. Please choose a different username.');
      }
      // Update username in DB
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { username: cleanedUserData.username },
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
        },
      });
      // Invalidate old and new username cache
      await this.redisService.delete(usernameKey);
      return updatedUser;
    }

    // For all other updates, keep existing logic
    // Check if username is provided and validate uniqueness (no Redis for bulk update)
    if (cleanedUserData.username) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username: cleanedUserData.username }
      });
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Username already exists. Please choose a different username.');
      }
    }

    // Prepare doctor data if provided
    let doctorData: any = undefined;
    if (doctor) {
      const cleanedDoctor = cleanData(doctor);
      if (Object.keys(cleanedDoctor).length > 0) {
        doctorData = {
          ...cleanedDoctor,
          experience: cleanedDoctor.experience ? Number(cleanedDoctor.experience) : undefined,
          consultationFee: cleanedDoctor.consultationFee ? Number(cleanedDoctor.consultationFee) : undefined,
        };
        // Remove undefined values
        doctorData = cleanData(doctorData);
      }
    }

    // Prepare patient data if provided
    let patientData: any = undefined;
    if (patient) {
      const cleanedPatient = cleanData(patient);
      if (Object.keys(cleanedPatient).length > 0) {
        patientData = cleanedPatient;
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...cleanedUserData,
        ...(doctorData && Object.keys(doctorData).length > 0 && {
          doctor: {
            update: doctorData
          }
        }),
        ...(patientData && Object.keys(patientData).length > 0 && {
          patient: {
            update: patientData
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
