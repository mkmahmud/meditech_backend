import {
    PrismaClient, UserRole, UserStatus, Gender, Specialization,
    AppointmentStatus, AppointmentType, PaymentStatus, PaymentMethod,
    PaymentProvider, PaymentType, InsuranceStatus
} from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const password = await bcrypt.hash('Password123!', 10);

    // 1. Seed Users (Doctors & Patients)
    const { doctorIds, patientIds, patientUserIds } = await seedUsers(password);

    // 2. Seed Medical Basics (History, Vitals, Allergies)
    await seedMedicalBasics(patientIds);

    // 3. Seed Appointments & Prescriptions (300 Completed, 200 Others)
    const appointmentIds = await seedAppointments(doctorIds, patientIds);

    // 4. Seed Lab Results
    await seedLabResults(patientIds);

    // 5. Seed Insurance & Payments

    // 6. Seed Notifications
    await seedNotifications(patientUserIds);

    console.log('✅ Full System Seed Completed!');
}

async function seedUsers(password: string) {
    const doctorIds: string[] = [];
    const patientIds: string[] = [];
    const patientUserIds: string[] = [];

    for (let i = 0; i < 50; i++) {
        const email = `doctor${i}@hospital.com`;
        const doc = await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email, password, role: UserRole.DOCTOR, status: UserStatus.ACTIVE,
                firstName: faker.person.firstName('male'), lastName: faker.person.lastName(),
                doctor: {
                    create: {
                        licenseNumber: `LIC-${faker.string.alphanumeric(7).toUpperCase()}`,
                        specialization: faker.helpers.arrayElement(Object.values(Specialization)),
                        experience: faker.number.int({ min: 5, max: 25 }),
                        consultationFee: 150.00
                    }
                }
            },
            include: { doctor: true }
        });
        if (doc.doctor) doctorIds.push(doc.doctor.id);
    }

    for (let i = 0; i < 100; i++) {
        const email = `patient${i}@test.com`;
        const pat = await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email, password, role: UserRole.PATIENT, status: UserStatus.ACTIVE,
                firstName: faker.person.firstName(), lastName: faker.person.lastName(),
                patient: { create: { bloodType: 'B+', height: 170, weight: 70 } }
            },
            include: { patient: true }
        });
        if (pat.patient) {
            patientIds.push(pat.patient.id);
            patientUserIds.push(pat.id);
        }
    }
    return { doctorIds, patientIds, patientUserIds };
}

async function seedMedicalBasics(patientIds: string[]) {
    for (const id of patientIds) {
        await prisma.medicalHistory.create({
            data: {
                patientId: id,
                condition: faker.helpers.arrayElement(['Hypertension', 'Type 2 Diabetes', 'Asthma']),
                diagnosedAt: faker.date.past(),
                isActive: true
            }
        });
        await prisma.vitalSign.create({
            data: {
                patientId: id,
                bloodPressureSystolic: 120,
                bloodPressureDiastolic: 80,
                heartRate: 72,
                weight: 70,
                recordedAt: new Date()
            }
        });
    }
}

async function seedAppointments(doctorIds: string[], patientIds: string[]) {
    const appointmentIds: string[] = [];
    for (let i = 0; i < 500; i++) {
        const status = i < 300 ? AppointmentStatus.COMPLETED : AppointmentStatus.SCHEDULED;
        const appt = await prisma.appointment.create({
            data: {
                patientId: faker.helpers.arrayElement(patientIds),
                doctorId: faker.helpers.arrayElement(doctorIds),
                scheduledAt: faker.date.recent(),
                status,
                type: AppointmentType.IN_PERSON,
            }
        });
        appointmentIds.push(appt.id);

        if (status === AppointmentStatus.COMPLETED) {
            await prisma.prescription.create({
                data: {
                    patientId: appt.patientId,
                    doctorId: appt.doctorId,
                    medications: { create: [{ medicationName: 'Amoxicillin', dosage: '500mg', frequency: '1x daily', duration: '7 days' }] }
                }
            });
        }
    }
    return appointmentIds;
}

async function seedLabResults(patientIds: string[]) {
    for (let i = 0; i < 50; i++) {
        await prisma.labResult.create({
            data: {
                patientId: faker.helpers.arrayElement(patientIds),
                testName: 'Complete Blood Count',
                testType: 'Blood Test',
                orderedAt: faker.date.past(),
                isAbnormal: faker.datatype.boolean()
            }
        });
    }
}

async function seedNotifications(userIds: string[]) {
    await prisma.notification.createMany({
        data: userIds.map(uid => ({
            userId: uid,
            type: 'GENERAL',
            title: 'Monthly Checkup',
            message: 'Don\'t forget to book your monthly checkup for April.',
        }))
    });
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());