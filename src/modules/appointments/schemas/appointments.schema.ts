import { z } from "zod";

const AppointmentTypeEnum = z.enum(["IN_PERSON", "TELEMEDICINE", "FOLLOW_UP", "EMERGENCY"]);

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