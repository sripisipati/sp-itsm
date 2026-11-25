import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleName } from "../../generated/prisma/client";
import { AuthenticatedUser } from "../auth/authenticated-user";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const roles = request.user?.roles ?? [];
    if (required.some((role) => roles.includes(role))) return true;
    throw new ForbiddenException("You do not have permission to perform this action.");
  }
}
