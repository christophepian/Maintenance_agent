import { z } from 'zod';
import { JobStatus } from '@prisma/client';

export const JobStatusEnum = z.enum([
  JobStatus.PENDING,
  JobStatus.IN_PROGRESS,
  JobStatus.COMPLETED,
  JobStatus.INVOICED,
]);

export const CreateJobSchema = z.object({
  requestId: z.string().uuid('Invalid request ID'),
  contractorId: z.string().uuid('Invalid contractor ID'),
});

export const UpdateJobSchema = z.object({
  status: JobStatusEnum.optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  actualCost: z.number().int().min(0).max(100000).optional(),
});

export type CreateJobPayload = z.infer<typeof CreateJobSchema>;
export type UpdateJobPayload = z.infer<typeof UpdateJobSchema>;
