import { z } from "zod";

const AppointmentTypeEnum = z.enum(["IN_PERSON", "TELEMEDICINE", "FOLLOW_UP", "EMERGENCY"]);
const booleanQueryParam = z.preprocess((value) => {
    if (typeof value === "string") {
        const normalized = value.toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
    }
    return value;
}, z.boolean());

// Create Appointment Schema
export const createAppointmentSchema = z.object({
    // Relational IDs
    doctorId: z.string().uuid("Invalid doctor ID"),

    // Patient Id
    patientId: z.string().uuid("Invalid patient ID"),

    // Date and Time
    // We use coerce to turn ISO strings from the frontend into Date objects
    scheduledAt: z.coerce.date({
        required_error: "Please select a date and time",
        invalid_type_error: "That's not a valid date",
    }).refine((date) => date > new Date(), {
        message: "Appointment must be in the future",
    }),

    // Consultation Details
    type: AppointmentTypeEnum,

    duration: z.number().int().min(15).max(120).default(30),

    chiefComplaint: z.string()
        .min(5, "Please provide more detail about your symptoms")
        .max(1000, "Description is too long")
        .trim(),

});

export type CreateAppointmentDTO = z.infer<typeof createAppointmentSchema>;

// Get Appointments by Doctor ID Schema
export const getAppointmentsByDoctorIdSchema = z.object({
    doctorId: z.string().uuid("Invalid doctor ID"),
    date: z.string().optional(),
    download: booleanQueryParam.optional(),
});

export type GetAppointmentsByDoctorIdDTO = z.infer<typeof getAppointmentsByDoctorIdSchema>;

// Get Appointments by Patient ID Schema
export const getAppointmentsByPatientIdSchema = z.object({
    patientId: z.string().uuid("Invalid patient ID"),
});

export type GetAppointmentsByPatientIdDTO = z.infer<typeof getAppointmentsByPatientIdSchema>;

// Cancel Appointment Schema
export const cancelAppointmentSchema = z.object({
    appointmentId: z.string().uuid("Invalid appointment ID"),
    patientId: z.string().uuid("Invalid patient ID"),
    doctorId: z.string().uuid("Invalid doctor ID"),
    cancellationReason: z.string()
        .min(5, "Please provide a cancellation reason with at least 5 characters")
        .max(500, "Cancellation reason is too long")
        .trim()
        .optional(),
});

export type CancelAppointmentDTO = z.infer<typeof cancelAppointmentSchema>;

// Get Appointment Details Schema
export const getAppointmentDetailsByIdSchema = z.object({
    appointmentId: z.string().uuid("Invalid appointment ID"),
});

export type GetAppointmentDetailsByIdDTO = z.infer<typeof getAppointmentDetailsByIdSchema>;

// Complete Appointment Schema
export const completeAppointmentSchema = z.object({
    appointmentId: z.string().uuid("Invalid appointment ID"),
    doctorId: z.string().uuid("Invalid doctor ID"),
    diagnosis: z.string()
        .min(5, "Please provide a diagnosis with at least 5 characters")
        .max(2000, "Diagnosis is too long")
        .trim()
        .optional(),
    notes: z.string()
        .min(5, "Please provide notes with at least 5 characters")
        .max(2000, "Notes are too long")
        .trim()
        .optional(),
});

export type CompleteAppointmentDTO = z.infer<typeof completeAppointmentSchema>;