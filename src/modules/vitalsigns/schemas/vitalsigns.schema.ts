import { z } from 'zod';

// VitalSign Schema
export const vitalSignSchema = z.object({
    id: z.string().uuid('Invalid vital sign ID'),
    patientId: z.string().uuid('Invalid patient ID'),
    // patient: not included here, handled by ORM/relations

    bloodPressureSystolic: z.number().int().min(0, 'Systolic pressure must be positive').max(300, 'Systolic pressure is too high').optional(),
    bloodPressureDiastolic: z.number().int().min(0, 'Diastolic pressure must be positive').max(200, 'Diastolic pressure is too high').optional(),
    heartRate: z.number().int().min(0, 'Heart rate must be positive').max(300, 'Heart rate is too high').optional(),
    temperature: z.number().min(25, 'Temperature too low').max(45, 'Temperature too high').optional(),
    oxygenSaturation: z.number().min(0, 'Oxygen saturation must be positive').max(100, 'Oxygen saturation max is 100').optional(),
    bloodGlucose: z.number().min(0, 'Blood glucose must be positive').max(1000, 'Blood glucose too high').optional(),
    weight: z.number().min(0, 'Weight must be positive').max(500, 'Weight too high').optional(),

    recordedAt: z.string().datetime({ message: 'Invalid recordedAt date format' }).optional(),
    notes: z.string().max(1000, 'Notes are too long').optional(),
});

export type VitalSignDto = z.infer<typeof vitalSignSchema>;
