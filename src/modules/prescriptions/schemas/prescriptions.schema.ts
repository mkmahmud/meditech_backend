import { z } from 'zod';

// Medication Schema
export const medicationSchema = z.object({
    medicationName: z.string().min(2, 'Medication name must be at least 2 characters').max(200, 'Medication name is too long'),
    dosage: z.string().min(1, 'Dosage is required').max(100, 'Dosage is too long'),
    frequency: z.string().min(2, 'Frequency is required').max(100, 'Frequency is too long'),
    duration: z.string().min(1, 'Duration is required').max(100, 'Duration is too long'),
    instructions: z.string().max(500, 'Instructions are too long').optional(),
    refillsAllowed: z.coerce.number().int().min(0, 'Refills must be 0 or more').max(12, 'Maximum 12 refills allowed').default(0),
});

export type MedicationDto = z.infer<typeof medicationSchema>;

// Create Prescription Schema
export const createPrescriptionSchema = z.object({
    patientId: z.string().uuid('Invalid patient ID'),
    doctorId: z.string().uuid('Invalid doctor ID'),
    medications: z.array(medicationSchema).min(1, 'At least one medication is required').max(20, 'Maximum 20 medications per prescription'),
    expiresAt: z.string().datetime({ message: 'Invalid expiration date format' }).optional(),
    notes: z.string().max(1000, 'Notes are too long').optional(),
});

export type CreatePrescriptionDto = z.infer<typeof createPrescriptionSchema>;

// Update Prescription Schema
export const updatePrescriptionSchema = z.object({
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED']).optional(),
    notes: z.string().max(1000, 'Notes are too long').optional(),
    expiresAt: z.string().datetime({ message: 'Invalid expiration date format' }).optional(),
});

export type UpdatePrescriptionDto = z.infer<typeof updatePrescriptionSchema>;

// Get Prescriptions Query Schema
export const getPrescriptionsSchema = z.object({
    patientId: z.string().uuid('Invalid patient ID').optional(),
    doctorId: z.string().uuid('Invalid doctor ID').optional(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED']).optional(),
    limit: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive().max(100)).optional().default('20'),
    offset: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().min(0)).optional().default('0'),
});

export type GetPrescriptionsDto = z.infer<typeof getPrescriptionsSchema>;

// Get Prescription by ID Schema
export const getPrescriptionByIdSchema = z.object({
    id: z.string().uuid('Invalid prescription ID'),
});

export type GetPrescriptionByIdDto = z.infer<typeof getPrescriptionByIdSchema>;

// Add Medication to Prescription Schema
export const addMedicationSchema = z.object({
    prescriptionId: z.string().uuid('Invalid prescription ID'),
    medication: medicationSchema,
});

export type AddMedicationDto = z.infer<typeof addMedicationSchema>;

// Update Medication Schema
export const updateMedicationSchema = z.object({
    medicationId: z.string().uuid('Invalid medication ID'),
    medicationName: z.string().min(2, 'Medication name must be at least 2 characters').max(200, 'Medication name is too long').optional(),
    dosage: z.string().min(1, 'Dosage is required').max(100, 'Dosage is too long').optional(),
    frequency: z.string().min(2, 'Frequency is required').max(100, 'Frequency is too long').optional(),
    duration: z.string().min(1, 'Duration is required').max(100, 'Duration is too long').optional(),
    instructions: z.string().max(500, 'Instructions are too long').optional(),
    refillsAllowed: z.coerce.number().int().min(0, 'Refills must be 0 or more').max(12, 'Maximum 12 refills allowed').optional(),
});

export type UpdateMedicationDto = z.infer<typeof updateMedicationSchema>;

// Refill Medication Schema
export const refillMedicationSchema = z.object({
    medicationId: z.string().uuid('Invalid medication ID'),
});

export type RefillMedicationDto = z.infer<typeof refillMedicationSchema>;

// Send to Pharmacy Schema
export const sendToPharmacySchema = z.object({
    prescriptionId: z.string().uuid('Invalid prescription ID'),
    pharmacyId: z.string().uuid('Invalid pharmacy ID'),
});

export type SendToPharmacyDto = z.infer<typeof sendToPharmacySchema>;

// Sign Prescription Schema
export const signPrescriptionSchema = z.object({
    prescriptionId: z.string().uuid('Invalid prescription ID'),
    doctorId: z.string().uuid('Invalid doctor ID'),
    signature: z.string().min(10, 'Digital signature is required'),
});

export type SignPrescriptionDto = z.infer<typeof signPrescriptionSchema>;
