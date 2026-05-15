import {
    PrismaClient,
    UserRole,
    UserStatus,
    Specialization,
    AppointmentType,
    AppointmentStatus,
    PaymentStatus,
    PaymentMethod,
    PaymentProvider,
    PaymentType,
    NotificationType,
    AuditAction,
    RefundStatus
} from '@prisma/client';

import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding...");

    const password = await bcrypt.hash('Password123!', 10);

    const { doctorIds, patientIds, userIds } = await seedUsers(password);

    await seedDoctorAvailability(doctorIds);
    await seedFamilyMembers(patientIds);

    await seedMedical(patientIds);
    await seedVitals(patientIds);

    const appointmentIds = await seedAppointments(doctorIds, patientIds);
    const prescriptionIds = await seedPrescriptions(doctorIds, patientIds);

    await seedMedications(prescriptionIds);
    await seedLab(patientIds);

    const paymentIds = await seedPayments(patientIds, appointmentIds);
    await seedRefunds(paymentIds);
    await seedTransactions(paymentIds);

    await seedNotifications(userIds);
    await seedAudit(userIds);

    await seedConfig();

    console.log("✅ Done");
}

async function seedUsers(password: string) {
    const doctorIds: string[] = [];
    const patientIds: string[] = [];
    const userIds: string[] = [];

    for (let i = 0; i < 20; i++) {
        const user = await prisma.user.upsert({
            where: { email: `doctor${i}@mail.com` },
            update: {},
            create: {
                email: `doctor${i}@mail.com`,
                password,
                role: UserRole.DOCTOR,
                status: UserStatus.ACTIVE,
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName()
            }
        });

        userIds.push(user.id);

        const doctor = await prisma.doctor.upsert({
            where: { userId: user.id },
            update: {},
            create: {
                userId: user.id,
                licenseNumber: faker.string.uuid(),
                specialization: faker.helpers.arrayElement(Object.values(Specialization)),
                qualifications: ["MBBS"],
                experience: 5,
                consultationFee: 100
            }
        });

        doctorIds.push(doctor.id);
    }

    for (let i = 0; i < 20; i++) {
        const user = await prisma.user.upsert({
            where: { email: `patient${i}@mail.com` },
            update: {},
            create: {
                email: `patient${i}@mail.com`,
                password,
                role: UserRole.PATIENT,
                status: UserStatus.ACTIVE,
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName()
            }
        });

        userIds.push(user.id);

        const patient = await prisma.patient.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id }
        });

        patientIds.push(patient.id);
    }

    return { doctorIds, patientIds, userIds };
}

async function seedDoctorAvailability(doctorIds: string[]) {
    await prisma.doctorAvailability.createMany({
        data: doctorIds.flatMap(id =>
            Array.from({ length: 7 }).map((_, d) => ({
                doctorId: id,
                dayOfWeek: d,
                startTime: "09:00",
                endTime: "17:00"
            }))
        ),
        skipDuplicates: true
    });
}

async function seedFamilyMembers(patientIds: string[]) {
    const used = new Set<string>();

    for (let i = 0; i < 20; i++) {
        let head = faker.helpers.arrayElement(patientIds);
        let member = faker.helpers.arrayElement(patientIds);

        while (member === head || used.has(member)) {
            member = faker.helpers.arrayElement(patientIds);
        }

        used.add(member);

        await prisma.familyMember.upsert({
            where: { memberPatientId: member },
            update: {},
            create: {
                headPatientId: head,
                memberPatientId: member,
                relationship: "SIBLING"
            }
        });
    }
}

async function seedMedical(patientIds: string[]) {
    await prisma.medicalHistory.createMany({
        data: patientIds.map(id => ({
            patientId: id,
            condition: "Diabetes",
            diagnosedAt: faker.date.past()
        })),
        skipDuplicates: true
    });

    await prisma.allergy.createMany({
        data: patientIds.map(id => ({
            patientId: id,
            allergen: "Dust",
            severity: "MILD"
        })),
        skipDuplicates: true
    });
}

async function seedVitals(patientIds: string[]) {
    await prisma.vitalSign.createMany({
        data: patientIds.map(id => ({
            patientId: id,
            heartRate: 70,
            temperature: 37
        })),
        skipDuplicates: true
    });
}

async function seedAppointments(doctorIds: string[], patientIds: string[]) {
    const ids: string[] = [];

    for (let i = 0; i < 20; i++) {
        const a = await prisma.appointment.create({
            data: {
                doctorId: faker.helpers.arrayElement(doctorIds),
                patientId: faker.helpers.arrayElement(patientIds),
                scheduledAt: faker.date.recent(),
                type: AppointmentType.IN_PERSON,
                status: AppointmentStatus.COMPLETED
            }
        });
        ids.push(a.id);
    }

    return ids;
}

async function seedPrescriptions(doctorIds: string[], patientIds: string[]) {
    const ids: string[] = [];

    for (let i = 0; i < 20; i++) {
        const p = await prisma.prescription.create({
            data: {
                doctorId: faker.helpers.arrayElement(doctorIds),
                patientId: faker.helpers.arrayElement(patientIds)
            }
        });
        ids.push(p.id);
    }

    return ids;
}

async function seedMedications(ids: string[]) {
    await prisma.prescriptionMedication.createMany({
        data: ids.map(id => ({
            prescriptionId: id,
            medicationName: "Paracetamol",
            dosage: "500mg",
            frequency: "Twice daily",
            duration: "5 days"
        })),
        skipDuplicates: true
    });
}

async function seedLab(patientIds: string[]) {
    await prisma.labResult.createMany({
        data: patientIds.map(id => ({
            patientId: id,
            testName: "CBC",
            testType: "Blood",
            orderedAt: faker.date.past()
        })),
        skipDuplicates: true
    });
}

async function seedPayments(patientIds: string[], appointmentIds: string[]) {
    const ids: string[] = [];

    for (let i = 0; i < 20; i++) {
        const pay = await prisma.payment.create({
            data: {
                patientId: faker.helpers.arrayElement(patientIds),
                amount: 100,
                status: PaymentStatus.COMPLETED,
                method: PaymentMethod.CARD,
                provider: PaymentProvider.STRIPE,
                paymentType: PaymentType.APPOINTMENT_FEE,
                idempotencyKey: faker.string.uuid(),
                invoiceNumber: faker.string.uuid(),
                appointmentId: faker.helpers.arrayElement(appointmentIds)
            }
        });

        ids.push(pay.id);
    }

    return ids;
}

async function seedRefunds(paymentIds: string[]) {
    await prisma.refund.createMany({
        data: paymentIds.map(id => ({
            paymentId: id,
            amount: 10,
            reason: "Test refund",
            status: RefundStatus.COMPLETED,
            idempotencyKey: faker.string.uuid()
        })),
        skipDuplicates: true
    });
}

async function seedTransactions(paymentIds: string[]) {
    await prisma.paymentTransaction.createMany({
        data: paymentIds.map(id => ({
            paymentId: id,
            type: "CHARGE",
            status: "SUCCESS",
            amount: 100
        })),
        skipDuplicates: true
    });
}

async function seedNotifications(userIds: string[]) {
    await prisma.notification.createMany({
        data: userIds.map(id => ({
            userId: id,
            type: NotificationType.GENERAL,
            title: "Hello",
            message: "Test notification"
        })),
        skipDuplicates: true
    });
}

async function seedAudit(userIds: string[]) {
    await prisma.auditLog.createMany({
        data: userIds.map(id => ({
            userId: id,
            action: AuditAction.LOGIN,
            resource: "User",
            ipAddress: faker.internet.ip(),
            endpoint: "/login",
            method: "POST"
        })),
        skipDuplicates: true
    });
}

async function seedConfig() {
    await prisma.systemConfig.createMany({
        data: [
            { key: "APP_NAME", value: "Meditech" },
            { key: "VERSION", value: "1.0.0" }
        ],
        skipDuplicates: true
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());