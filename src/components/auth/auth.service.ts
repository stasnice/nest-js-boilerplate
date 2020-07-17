import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from './constants';

import { IAuthLoginInput } from './interfaces/IAuthLoginInput.interface';
import { IAuthValidateUserOutput } from './interfaces/IAuthValidateUserOutput.interface';
import { IAuthLoginOutput  } from './interfaces/IAuthLoginOutput.interface';

import * as bcrypt from 'bcrypt';
import { RedisService } from 'nestjs-redis';
import * as Redis from 'ioredis';

@Injectable()
export class AuthService {
  private readonly redisClient: Redis.Redis;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService
  ) {
      this.redisClient = redisService.getClient();
  }

  async validateUser(email: string, password: string): Promise<null | IAuthValidateUserOutput> {
    const user = await this.usersService.getVerifiedByEmail(email);

    if (!user) {
        throw new NotFoundException('The item does not exist');
    }

    const passwordCompared = await bcrypt.compare(password, user.password);

    if (passwordCompared) {
      return {
          id: user.id,
          email: user.email,
      };
    }

    return null;
  }

  async login(data: IAuthLoginInput): Promise<IAuthLoginOutput> {
    const payload = {
      id: data.id,
      email: data.email,
    };

    const accessToken = this.jwtService.sign(payload, {
        expiresIn: jwtConstants.accessTokenExpirationTime,
    });
    const refreshToken = this.jwtService.sign(payload, {
        expiresIn: jwtConstants.refreshTokenExpirationTime,
    });

    await this.redisClient.set(
      payload.email,
      refreshToken,
      'EX',
      86400,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  getRefreshTokenByEmail(email: string): Promise<string> {
    return this.redisClient.get(email);
  }

  deleteTokenByEmail(email: string): Promise<number> {
    return this.redisClient.del(email);
  }

  deleteAllTokens(): Promise<string> {
    return this.redisClient.flushall();
  }
}