import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AppointmentStatus,
  PaymentStatus,
  PrescriptionStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  patient?: { id: string } | null;
  doctor?: { id: string } | null;
};

@Injectable()
export class OverviewService {
  constructor(private prisma: PrismaService) { }

  async getOverview(user: AuthenticatedUser) {
    switch (user.role) {
      case UserRole.PATIENT:
        return this.getPatientOverview(user);
      case UserRole.DOCTOR:
        return this.getDoctorOverview(user);
      case UserRole.ADMIN:
      case UserRole.SUPER_ADMIN:
        return this.getAdminOverview(user);
      default:
        return this.getStaffOverview(user);
    }
  }

  private async getPatientOverview(user: AuthenticatedUser) {
    const patientId = user.patient?.id;

    if (!patientId) {
      throw new NotFoundException('Patient profile not found');
    }

    const now = new Date();

    const [
      totalAppointments,
      upcomingAppointments,
      completedAppointments,
      cancelledAppointments,
      activePrescriptions,
      labResults,
      abnormalLabResults,
      latestVitalSign,
      activeInsurances,
      unreadNotifications,
      paymentSummary,
      recentAppointments,
      recentPayments,
    ] = await Promise.all([
      this.prisma.appointment.count({ where: { patientId } }),
      this.prisma.appointment.count({
        where: {
          patientId,
          scheduledAt: { gte: now },
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        },
      }),
      this.prisma.appointment.count({
        where: { patientId, status: AppointmentStatus.COMPLETED },
      }),
      this.prisma.appointment.count({
        where: { patientId, status: AppointmentStatus.CANCELLED },
      }),
      this.prisma.prescription.count({
        where: { patientId, status: PrescriptionStatus.ACTIVE },
      }),
      this.prisma.labResult.count({ where: { patientId } }),
      this.prisma.labResult.count({ where: { patientId, isAbnormal: true } }),
      this.prisma.vitalSign.findFirst({
        where: { patientId },
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.insurance.count({
        where: {
          patientId,
          status: 'ACTIVE',
          expirationDate: { gte: now },
        },
      }),
      this.prisma.notification.count({
        where: { userId: user.id, read: false },
      }),
      this.prisma.payment.aggregate({
        where: { patientId, status: PaymentStatus.COMPLETED },
        _sum: { amount: true, totalRefunded: true },
        _count: { id: true },
      }),
      this.prisma.appointment.findMany({
        where: { patientId },
        orderBy: { scheduledAt: 'desc' },
        take: 5,
        select: {
          id: true,
          scheduledAt: true,
          duration: true,
          type: true,
          status: true,
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
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          method: true,
          provider: true,
          paymentType: true,
          invoiceNumber: true,
          paidAt: true,
          createdAt: true,
        },
      }),
    ]);

    const totalSpend = paymentSummary._sum.amount || 0;
    const totalRefunded = paymentSummary._sum.totalRefunded || 0;

    return {
      role: user.role,
      user: this.getUserSummary(user),
      statistics: {
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments,
        activePrescriptions,
        labResults,
        abnormalLabResults,
        activeInsurances,
        unreadNotifications,
        totalPayments: paymentSummary._count.id,
        totalSpend,
        totalRefunded,
        netSpend: totalSpend - totalRefunded,
      },
      latestVitalSign,
      recentAppointments,
      recentPayments,
    };
  }

  private async getDoctorOverview(user: AuthenticatedUser) {
    const doctorId = user.doctor?.id;

    if (!doctorId) {
      throw new NotFoundException('Doctor profile not found');
    }

    const now = new Date();
    const monthStart = this.getMonthStart(now);
    const nextMonthStart = this.getNextMonthStart(now);
    const todayStart = this.getDayStart(now);
    const tomorrowStart = this.getNextDayStart(now);

    const monthlyAppointmentIds = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledAt: { gte: monthStart, lt: nextMonthStart },
      },
      select: { id: true },
    });

    const [
      totalAppointments,
      appointmentsThisMonth,
      todayAppointments,
      upcomingAppointments,
      completedAppointments,
      cancelledAppointments,
      uniquePatients,
      activePrescriptions,
      unreadNotifications,
      monthlyRevenue,
      recentAppointments,
    ] = await Promise.all([
      this.prisma.appointment.count({ where: { doctorId } }),
      this.prisma.appointment.count({
        where: {
          doctorId,
          scheduledAt: { gte: monthStart, lt: nextMonthStart },
        },
      }),
      this.prisma.appointment.count({
        where: {
          doctorId,
          scheduledAt: { gte: todayStart, lt: tomorrowStart },
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        },
      }),
      this.prisma.appointment.count({
        where: {
          doctorId,
          scheduledAt: { gte: now },
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        },
      }),
      this.prisma.appointment.count({
        where: { doctorId, status: AppointmentStatus.COMPLETED },
      }),
      this.prisma.appointment.count({
        where: { doctorId, status: AppointmentStatus.CANCELLED },
      }),
      this.prisma.appointment.groupBy({
        by: ['patientId'],
        where: { doctorId },
      }),
      this.prisma.prescription.count({
        where: { doctorId, status: PrescriptionStatus.ACTIVE },
      }),
      this.prisma.notification.count({
        where: { userId: user.id, read: false },
      }),
      this.prisma.payment.aggregate({
        where: {
          appointmentId: { in: monthlyAppointmentIds.map((appointment) => appointment.id) },
          status: PaymentStatus.COMPLETED,
        },
        _sum: { amount: true, totalRefunded: true },
        _count: { id: true },
      }),
      this.prisma.appointment.findMany({
        where: { doctorId },
        orderBy: { scheduledAt: 'desc' },
        take: 8,
        select: {
          id: true,
          scheduledAt: true,
          duration: true,
          type: true,
          status: true,
          chiefComplaint: true,
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
                  gender: true,
                  dateOfBirth: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const totalMonthlyRevenue = monthlyRevenue._sum.amount || 0;
    const totalMonthlyRefunded = monthlyRevenue._sum.totalRefunded || 0;

    return {
      role: user.role,
      user: this.getUserSummary(user),
      statistics: {
        totalAppointments,
        appointmentsThisMonth,
        todayAppointments,
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments,
        totalPatients: uniquePatients.length,
        activePrescriptions,
        unreadNotifications,
        monthlyPaidAppointments: monthlyRevenue._count.id,
        monthlyRevenue: totalMonthlyRevenue,
        monthlyRefunded: totalMonthlyRefunded,
        monthlyNetRevenue: totalMonthlyRevenue - totalMonthlyRefunded,
      },
      recentAppointments,
    };
  }

  private async getAdminOverview(user: AuthenticatedUser) {
    const now = new Date();
    const monthStart = this.getMonthStart(now);
    const nextMonthStart = this.getNextMonthStart(now);

    const [
      totalUsers,
      activeUsers,
      usersByRole,
      totalDoctors,
      totalPatients,
      totalAppointments,
      appointmentsThisMonth,
      appointmentsByStatus,
      totalPrescriptions,
      totalLabResults,
      abnormalLabResults,
      totalPayments,
      completedPaymentSummary,
      pendingPaymentSummary,
      monthlyPaymentSummary,
      refundsSummary,
      unreadNotifications,
      recentUsers,
      recentAppointments,
      recentPayments,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: { deletedAt: null },
        _count: { role: true },
      }),
      this.prisma.doctor.count({ where: { deletedAt: null } }),
      this.prisma.patient.count({ where: { deletedAt: null } }),
      this.prisma.appointment.count(),
      this.prisma.appointment.count({
        where: { scheduledAt: { gte: monthStart, lt: nextMonthStart } },
      }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.prescription.count(),
      this.prisma.labResult.count(),
      this.prisma.labResult.count({ where: { isAbnormal: true } }),
      this.prisma.payment.count(),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.COMPLETED },
        _sum: { amount: true, totalRefunded: true },
        _count: { id: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.PENDING },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.COMPLETED,
          createdAt: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { amount: true, totalRefunded: true },
        _count: { id: true },
      }),
      this.prisma.refund.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.notification.count({ where: { read: false } }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.appointment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          scheduledAt: true,
          type: true,
          status: true,
          patient: {
            select: {
              id: true,
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
              id: true,
              specialization: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          patientId: true,
          amount: true,
          currency: true,
          status: true,
          method: true,
          provider: true,
          paymentType: true,
          invoiceNumber: true,
          paidAt: true,
          createdAt: true,
        },
      }),
    ]);

    const totalRevenue = completedPaymentSummary._sum.amount || 0;
    const totalRefunded = completedPaymentSummary._sum.totalRefunded || 0;
    const monthlyRevenue = monthlyPaymentSummary._sum.amount || 0;
    const monthlyRefunded = monthlyPaymentSummary._sum.totalRefunded || 0;

    return {
      role: user.role,
      user: this.getUserSummary(user),
      statistics: {
        totalUsers,
        activeUsers,
        totalDoctors,
        totalPatients,
        totalAppointments,
        appointmentsThisMonth,
        totalPrescriptions,
        totalLabResults,
        abnormalLabResults,
        unreadNotifications,
        totalPayments,
        completedPayments: completedPaymentSummary._count.id,
        pendingPayments: pendingPaymentSummary._count.id,
        totalRevenue,
        totalRefunded,
        netRevenue: totalRevenue - totalRefunded,
        pendingAmount: pendingPaymentSummary._sum.amount || 0,
        monthlyPayments: monthlyPaymentSummary._count.id,
        monthlyRevenue,
        monthlyRefunded,
        monthlyNetRevenue: monthlyRevenue - monthlyRefunded,
        completedRefunds: refundsSummary._count.id,
        completedRefundAmount: refundsSummary._sum.amount || 0,
      },
      breakdowns: {
        usersByRole: this.mapGroupCounts(usersByRole, 'role'),
        appointmentsByStatus: this.mapGroupCounts(appointmentsByStatus, 'status'),
      },
      recentUsers,
      recentAppointments,
      recentPayments,
    };
  }

  private async getStaffOverview(user: AuthenticatedUser) {
    const [
      totalAppointments,
      upcomingAppointments,
      totalPatients,
      totalDoctors,
      unreadNotifications,
      recentAppointments,
    ] = await Promise.all([
      this.prisma.appointment.count(),
      this.prisma.appointment.count({
        where: {
          scheduledAt: { gte: new Date() },
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        },
      }),
      this.prisma.patient.count({ where: { deletedAt: null } }),
      this.prisma.doctor.count({ where: { deletedAt: null } }),
      this.prisma.notification.count({
        where: { userId: user.id, read: false },
      }),
      this.prisma.appointment.findMany({
        orderBy: { scheduledAt: 'asc' },
        take: 8,
        select: {
          id: true,
          scheduledAt: true,
          type: true,
          status: true,
          patient: {
            select: {
              id: true,
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
              id: true,
              specialization: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      role: user.role,
      user: this.getUserSummary(user),
      statistics: {
        totalAppointments,
        upcomingAppointments,
        totalPatients,
        totalDoctors,
        unreadNotifications,
      },
      recentAppointments,
    };
  }

  private getUserSummary(user: AuthenticatedUser) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  private getDayStart(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private getNextDayStart(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  }

  private getMonthStart(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private getNextMonthStart(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  }

  private mapGroupCounts(items: any[], field: string) {
    return items.reduce((acc, item) => {
      acc[item[field]] = item._count[field];
      return acc;
    }, {});
  }
}
