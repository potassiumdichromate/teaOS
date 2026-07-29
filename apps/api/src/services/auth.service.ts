import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { LoginInput, Role } from "@nvei/shared";
import { userRepository } from "../repositories/user.repository.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { securityEventRepository } from "../repositories/securityEvent.repository.js";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.middleware.js";

export async function login(input: LoginInput): Promise<{ token: string; role: Role }> {
  const user = await userRepository.findByEmail(input.email);
  if (!user) {
    await securityEventRepository.write({
      severity: "WARNING",
      category: "AUTH_FAILURE",
      detail: { email: input.email, reason: "no such user" },
    });
    throw new HttpError(401, "Invalid credentials");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    await securityEventRepository.write({
      severity: "WARNING",
      category: "AUTH_FAILURE",
      userId: user.id,
      detail: { email: input.email, reason: "bad password" },
    });
    throw new HttpError(401, "Invalid credentials");
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  const actionByRole: Record<
    Role,
    "TEACHER_LOGIN" | "STUDENT_LOGIN" | "CENTER_AUTHENTICATION" | "ADMIN_LOGIN" | "OBSERVER_LOGIN"
  > = {
    TEACHER: "TEACHER_LOGIN",
    STUDENT: "STUDENT_LOGIN",
    CENTER: "CENTER_AUTHENTICATION",
    ADMIN: "ADMIN_LOGIN",
    OBSERVER: "OBSERVER_LOGIN",
  };
  await auditLogRepository.write(actionByRole[user.role], { userId: user.id, metadata: { email: user.email } });

  return { token, role: user.role as Role };
}
