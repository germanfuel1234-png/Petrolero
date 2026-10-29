import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { authHabilitada } from './permisos.guard';

/**
 * Guard JWT que respeta el interruptor AUTH_HABILITADA.
 *
 * - AUTH_HABILITADA=false (default): deja pasar sin token. Quien decide es PermisosGuard,
 *   que también está apagado. Las funciones quedan usables mientras el cliente define roles.
 * - AUTH_HABILITADA=true: se comporta como el AuthGuard('jwt') normal, exige token válido
 *   y deja el usuario en `request.user` para que PermisosGuard verifique el permiso.
 *
 * Va SIEMPRE antes de PermisosGuard en @UseGuards: el orden importa, porque PermisosGuard
 * lee el usuario que este guard deja en la petición.
 */
@Injectable()
export class JwtOpcionalGuard extends AuthGuard('jwt') {
  canActivate(contexto: ExecutionContext) {
    if (!authHabilitada()) return true;
    return super.canActivate(contexto);
  }
}
