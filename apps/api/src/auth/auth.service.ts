import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { PERMISOS, type Rol } from './roles';

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nombre: string;
  rol: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });

    // Mismo mensaje para usuario inexistente y contraseña incorrecta: no conviene
    // revelar cuáles correos existen en el sistema.
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const coincide = await bcrypt.compare(password, usuario.passwordHash);
    if (!coincide) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const token = await this.jwt.signAsync({
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
    });

    return {
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        permisos: PERMISOS[usuario.rol as Rol] ?? [],
      },
    };
  }

  async perfil(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, email: true, nombre: true, rol: true },
    });

    if (!usuario) throw new UnauthorizedException('Usuario inexistente.');

    return { ...usuario, permisos: PERMISOS[usuario.rol as Rol] ?? [] };
  }
}
