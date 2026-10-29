import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { type Permiso, tienePermiso } from './roles';

export const PERMISO_REQUERIDO = 'permiso_requerido';

/** Decora un endpoint con el permiso que exige. Ej: @Requiere('crear:planes') */
export const Requiere = (permiso: Permiso): MethodDecorator =>
  SetMetadata(PERMISO_REQUERIDO, permiso);

/** La exigencia de permisos se activa con AUTH_HABILITADA=true. */
export function authHabilitada(): boolean {
  return process.env.AUTH_HABILITADA === 'true';
}

/**
 * Verifica que el usuario del token tenga el permiso declarado en el endpoint.
 *
 * TODO[CLIENTE]: la exigencia está APAGADA por defecto (AUTH_HABILITADA=false) porque el
 * esquema de roles real no está confirmado (ver ROLES_Y_PERMISOS en PENDIENTES-CLIENTE.md).
 * Apagada, el guard deja pasar la petición y avisa por log. Encendida, exige token válido
 * y el permiso correspondiente.
 *
 * Esto es deliberado y no un descuido: dejarlo prendido con un esquema de roles inventado
 * bloquearía funciones que el cliente necesita probar ahora. Antes de salir a producción
 * hay que poner AUTH_HABILITADA=true y conectar el login del frontend.
 */
@Injectable()
export class PermisosGuard implements CanActivate {
  private readonly logger = new Logger(PermisosGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const permiso = this.reflector.getAllAndOverride<Permiso | undefined>(PERMISO_REQUERIDO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    // Endpoint sin permiso declarado: no lo restringe este guard.
    if (!permiso) return true;

    const peticion = contexto.switchToHttp().getRequest();
    const usuario = peticion.user;

    if (!authHabilitada()) {
      this.logger.warn(
        `Permiso "${permiso}" NO verificado: AUTH_HABILITADA=false. ` +
          'Activar antes de producción.',
      );
      return true;
    }

    if (!usuario) {
      throw new UnauthorizedException('Se requiere iniciar sesión para esta operación.');
    }

    if (!tienePermiso(usuario.rol, permiso)) {
      throw new ForbiddenException(`El rol ${usuario.rol} no tiene permiso para "${permiso}".`);
    }

    return true;
  }
}
