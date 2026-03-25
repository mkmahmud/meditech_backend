import { Injectable, Inject, forwardRef, ConflictException } from '@nestjs/common';
// import { PrismaService } from '@/common/prisma/prisma.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) { }

  // Find All Users (with advanced filtering, sorting, field selection, soft delete awareness, and error handling)
  async findAll({
    search,
    username,
    email,
    role,
    status,
    createdFrom,
    createdTo,
    includeDeleted = false,
    fields,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 10,
  }: {
    search?: string;
    username?: string;
    email?: string;
    role?: string;
    status?: string;
    createdFrom?: string;
    createdTo?: string;
    includeDeleted?: boolean;
    fields?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    // Validate sortOrder
    if (sortOrder && !['asc', 'desc'].includes(sortOrder)) {
      throw new Error('Invalid sortOrder. Use "asc" or "desc".');
    }
    // Validate page/limit
    if (page < 1 || limit < 1) {
      throw new Error('Page and limit must be positive integers.');
    }
    const skip = (page - 1) * limit;
    // Build where clause
    const where: any = {};
    if (username) where.username = { contains: username, mode: 'insensitive' };
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (role) where.role = role;
    if (status) where.status = status;
    if (createdFrom || createdTo) {
      where.createdAt = {};
      if (createdFrom) where.createdAt.gte = new Date(createdFrom);
      if (createdTo) where.createdAt.lte = new Date(createdTo);
    }
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Field selection
    let select: any = {
      id: true,
      email: true,
      username: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      dateOfBirth: true,
      gender: true,
      profileImageUrl: true,
      emailVerified: true,
      phoneVerified: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      lastLogin: true,
      failedLoginAttempts: true,
      accountLockedUntil: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,

      patient: true,
      doctor: true,
      refreshTokens: true,
      auditLogs: true,
      notifications: true,
    };
    if (fields) {
      select = {};
      fields.split(',').forEach(f => {
        select[f.trim()] = true;
      });
      // Always include id
      select.id = true;
    }

    // Sorting
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const total = await this.prisma.user.count({ where });
    const data = await this.prisma.user.findMany({
      where,
      select,
      skip,
      take: limit,
      orderBy,
    });
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  // Update User Status (Admin only)
  async updateStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        status: true,
      }
    })
  }

  // Delete User (Soft Delete)
  async softDelete(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: UserStatus.INACTIVE },
      select: {
        id: true,
        deletedAt: true,
      }
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
