import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from './jwt.strategy';

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser | string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    if (data) {
      return user?.[data];
    }
    return user;
  },
);
