import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { AuthGuard } from './auth.guard';

jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(),
}));

describe('AuthGuard', () => {
  const guard = new AuthGuard();
  const verifyTokenMock = verifyToken as jest.Mock;

  const createContext = (authorization?: string) => {
    const request: { headers: { authorization?: string }; user?: unknown } = {
      headers: {},
    };

    if (authorization) {
      request.headers.authorization = authorization;
    }

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLERK_SECRET_KEY = 'sk_test_example';
  });

  it('rejects requests without a bearer token', async () => {
    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects invalid tokens', async () => {
    verifyTokenMock.mockRejectedValue(new Error('invalid token'));

    await expect(
      guard.canActivate(createContext('Bearer invalid-token')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('attaches the authenticated Clerk user id to the request', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'user_123' });
    const context = createContext('Bearer valid-token');
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { id: string } }>();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user_123', authenticated: true });
  });
});
