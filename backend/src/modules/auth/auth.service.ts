import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { presentUser } from "../users/user.presenter";
import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto, ip: string) {
    this.assertLoginRate(ip);
    const user = await this.users.findByEmail(dto.email);
    const passwordOk = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !user.isActive || !passwordOk) {
      throw new UnauthorizedException("Email or password is incorrect.");
    }
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });
    const authUser = await this.users.findAuthUser(user.id);
    return {
      data: {
        accessToken,
        user: presentUser(user),
        roles: authUser?.roles ?? [],
        groupIds: authUser?.groupIds ?? [],
      },
    };
  }

  private assertLoginRate(ip: string): void {
    if (process.env.NODE_ENV === "test") return;
    const now = Date.now();
    const current = this.attempts.get(ip);
    if (!current || current.resetAt < now) {
      this.attempts.set(ip, { count: 1, resetAt: now + 60_000 });
      return;
    }
    current.count += 1;
    if (current.count > 10) {
      throw new UnauthorizedException("Too many sign-in attempts. Try again in a minute.");
    }
  }
}
