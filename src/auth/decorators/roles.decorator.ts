import { Role } from '@prisma/client';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const AdminOnly = () => Roles(Role.ADMIN);
export const ManagerOnly = () => Roles(Role.MANAGER, Role.ADMIN);
