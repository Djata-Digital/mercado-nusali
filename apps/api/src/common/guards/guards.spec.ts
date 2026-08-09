import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';

describe('Guards Unit Tests', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('RolesGuard', () => {
    it('should allow access if no roles are required', () => {
      const guard = new RolesGuard(reflector);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const mockContext = {
        getHandler: () => {},
        getClass: () => {},
      } as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should allow access if user has required role', () => {
      const guard = new RolesGuard(reflector);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);

      const mockContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { roles: ['BUYER', 'ADMIN'] },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should throw ForbiddenException if user lacks required role', () => {
      const guard = new RolesGuard(reflector);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);

      const mockContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { roles: ['BUYER'] },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('PermissionsGuard', () => {
    it('should allow access if no permissions are required', () => {
      const guard = new PermissionsGuard(reflector);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const mockContext = {
        getHandler: () => {},
        getClass: () => {},
      } as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should allow access if user has all required permissions', () => {
      const guard = new PermissionsGuard(reflector);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['manage_products', 'manage_orders']);

      const mockContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { permissions: ['manage_products', 'manage_orders', 'view_financials'] },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should throw ForbiddenException if user lacks required permission', () => {
      const guard = new PermissionsGuard(reflector);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['manage_users']);

      const mockContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { permissions: ['manage_products'] },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});
