import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { UsuarioAutenticado } from './auth.service';

interface PayloadJwt {
  sub: string;
  email: string;
  nombre: string;
  rol: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-cambiar-en-produccion',
    });
  }

  /** Lo que devuelve acá queda disponible como `request.user`. */
  validate(payload: PayloadJwt): UsuarioAutenticado {
    return {
      id: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      rol: payload.rol,
    };
  }
}
