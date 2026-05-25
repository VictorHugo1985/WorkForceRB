import { RolUsuario } from '@prisma/client';

export class LoginResponseDto {
  nombre: string;
  roles: RolUsuario[];
  debeChangiarPassword: boolean;
}
