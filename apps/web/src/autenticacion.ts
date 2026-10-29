/**
 * Maneja la sesión del usuario: valida el token guardado al cargar la app,
 * y expone login/logout. El token en sí vive en api.ts (única fuente de verdad),
 * acá solo se orquesta el estado de React alrededor de eso.
 */

import { useCallback, useEffect, useState } from 'react';

import { api, type UsuarioAutenticado } from './api';

export function useSesion() {
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);
  const [verificando, setVerificando] = useState(api.hayToken());

  useEffect(() => {
    if (!api.hayToken()) return;

    api
      .perfil()
      .then(setUsuario)
      .catch(() => {
        // Token vencido o inválido: se descarta y vuelve a pedir login.
        api.setToken(null);
      })
      .finally(() => setVerificando(false));
  }, []);

  const ingresar = useCallback(async (email: string, password: string) => {
    const { token, usuario: nuevoUsuario } = await api.login(email, password);
    api.setToken(token);
    setUsuario(nuevoUsuario);
  }, []);

  const salir = useCallback(() => {
    api.setToken(null);
    setUsuario(null);
  }, []);

  return { usuario, verificando, ingresar, salir };
}
