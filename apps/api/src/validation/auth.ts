import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, { message: "password must be at least 8 characters" }),
  name: z.string().min(1, { message: "name is required" }),
  role: z.enum(["TENANT", "CONTRACTOR", "MANAGER"]).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, { message: "password is required" }),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
