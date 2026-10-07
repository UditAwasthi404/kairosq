import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    }).compile();

    controller = module.get(AuthController);
  });

  it('returns the authenticated identity from the request', () => {
    expect(controller.getMe({ id: 'user_123', authenticated: true })).toEqual({
      id: 'user_123',
      authenticated: true,
    });
  });
});

describe('AuthGuard contract', () => {
  it('throws UnauthorizedException when verification fails', async () => {
    const guard = new AuthGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer bad' } }),
      }),
    };

    process.env.CLERK_SECRET_KEY = 'sk_test_example';

    await expect(guard.canActivate(context as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
