import { useState, type FormEvent } from 'react';

import { MarcaAgua } from '../componentes/MarcaAgua';

interface Props {
  onIngresar: (email: string, password: string) => Promise<void>;
}

export function VistaLogin({ onIngresar }: Props): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await onIngresar(email, password);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo iniciar sesión');
      setEnviando(false);
    }
  }

  return (
    <div className="pantalla-login">
      <form className="tarjeta-login" onSubmit={manejarEnvio}>
        <div className="marca">
          <span className="punto" />
          GESTIÓN DE VÁLVULAS
        </div>

        {error && <div className="error">{error}</div>}

        <div className="campo">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            required
          />
        </div>

        <div className="campo">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(evento) => setPassword(evento.target.value)}
            required
          />
        </div>

        <button type="submit" className="boton boton-ancho" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <MarcaAgua />
    </div>
  );
}
