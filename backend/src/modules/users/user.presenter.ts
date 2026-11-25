import { RoleName } from "../../generated/prisma/client";

export interface UserRecord {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  roles?: { role: { name: RoleName } }[];
}

export function presentUser(user: UserRecord) {
  return {
    id: user.id,
    employeeId: user.employeeId,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    isActive: user.isActive,
    roles: user.roles?.map((entry) => entry.role.name) ?? [],
  };
}

export const userSelect = {
  id: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;
