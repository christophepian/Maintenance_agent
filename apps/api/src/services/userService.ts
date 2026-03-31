/**
 * User Service
 *
 * Handles user registration and authentication (CQ-8 resolution).
 * Extracted from routes/auth.ts to move direct Prisma calls
 * out of the route layer.
 */

import * as bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { encodeToken } from "./auth";

// ─── DTOs ──────────────────────────────────────────────────────

export interface UserDTO {
  id: string;
  orgId: string;
  email: string | null;
  name: string | null;
  role: string;
}

export interface AuthResult {
  token: string;
  user: UserDTO;
}

// ─── Register ──────────────────────────────────────────────────

export async function registerUser(
  prisma: PrismaClient,
  orgId: string,
  input: { email: string; password: string; name: string; role?: string },
): Promise<AuthResult> {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      orgId,
      email: input.email,
      name: input.name,
      passwordHash,
      role: (input.role || "TENANT") as Role,
    },
  });

  const token = encodeToken({
    userId: user.id,
    orgId: user.orgId,
    email: user.email || input.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

// ─── Login ─────────────────────────────────────────────────────

export async function authenticateUser(
  prisma: PrismaClient,
  orgId: string,
  input: { email: string; password: string },
): Promise<AuthResult | null> {
  const user = await prisma.user.findUnique({
    where: { user_org_email_unique: { orgId, email: input.email } },
  });

  if (!user || !user.passwordHash) return null;

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) return null;

  const token = encodeToken({
    userId: user.id,
    orgId: user.orgId,
    email: user.email || input.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}
