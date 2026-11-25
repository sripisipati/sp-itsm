import { RoleName } from "../../generated/prisma/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
  groupIds: string[];
}

export function displayName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`;
}
