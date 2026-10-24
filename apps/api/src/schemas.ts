// apps/api/src/schemas.ts
// Zod validation schemas for API request bodies.
// Zod stays in the API only (techstack.md section 4).

import { z } from 'zod';

// Join: name, serviceId, optional slotId, optional requestPriority
export const joinSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required.')
    .max(60, 'Name must be 60 characters or fewer.')
    .transform((s) => s.trim()),
  serviceId: z.string().min(1, 'Service ID is required.'),
  slotId: z.string().optional(),
  requestPriority: z.boolean().optional(),
});

// Cancel: cancelSecret in body
export const cancelSchema = z.object({
  cancelSecret: z.string().min(1, 'Cancel secret is required.'),
});

// Admin login: passcode
export const loginSchema = z.object({
  passcode: z.string().min(1, 'Passcode is required.'),
});

// Add counter: name, serviceIds
export const addCounterSchema = z.object({
  name: z.string().min(1, 'Counter name is required.').max(60),
  serviceIds: z.array(z.string()).min(1, 'At least one service ID is required.'),
});

// Set counter services
export const setCounterServicesSchema = z.object({
  serviceIds: z.array(z.string()).min(1, 'At least one service ID is required.'),
});

// Update settings: partial settings object
export const updateSettingsSchema = z.object({
  calmMax: z.number().int().min(1).optional(),
  busyMax: z.number().int().min(1).optional(),
  approachingAhead: z.number().int().min(0).optional(),
  significantEtaChangeMinutes: z.number().min(0).optional(),
  graceMinutes: z.number().min(0).optional(),
  maxMisses: z.number().int().min(0).optional(),
  missedPolicy: z.enum(['requeue_last_in_tier', 'expire']).optional(),
  appointmentEarlyMinutes: z.number().min(0).optional(),
  appointmentLateMinutes: z.number().min(0).optional(),
  confidenceMaxCv: z.number().min(0).max(1).optional(),
  confidenceWindowMinutes: z.number().min(0).optional(),
  maxWaiting: z.number().int().min(1).optional(),
});

// Recall missed token: counterId in body
export const recallMissedSchema = z.object({
  counterId: z.string().min(1, 'Counter ID is required.'),
});

export type JoinInput = z.infer<typeof joinSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AddCounterInput = z.infer<typeof addCounterSchema>;
export type SetCounterServicesInput = z.infer<typeof setCounterServicesSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type RecallMissedInput = z.infer<typeof recallMissedSchema>;
