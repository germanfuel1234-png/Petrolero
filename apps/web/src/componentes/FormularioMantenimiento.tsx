import {
  ETIQUETA_ESTADO,
  calcularProximaRevision,
  requiereAccionCorrectiva,
  type TipoAccionCorrectiva,
  type ValvulaConEstado,
} from '@petrolero/shared';
import { useState } from 'react';

import { api } from '../api';
import { aIsoCompleto, hoyEnIso } from '../fechas';
import { BannerSupuesto } from './BannerSupuesto';

interface Props {
  valvula: ValvulaConEstado;
  pozoNombre: string;
  tiposAccion: TipoAccionCorrectiva[];
  onCerrar: () => void;
  onGuardado: () => void;
}

/**
 * Formulario de registro de mantenimiento, pensado para carga rápida y repetitiva.
 *
 * Las reglas (próxima revisión a +1 año, acción obligatoria si da negativo) las impone
 * el backend. Acá se usan las mismas funciones de @petrolero/shared solo para
 * previsualizar el resultado y evitar un viaje al servidor que ya se sabe que falla.
 */
export function FormularioMantenimiento({
  valvula,
  pozoNombre,
  tiposAccion,
  onCerrar,
  onGuardado,
}: Props): JSX.Element {
  const [fecha, setFecha] = useState(hoyEnIso());
  const [engrase, setEngrase] = useState(true);
  const [resultado, setResultado] = useState<'OK' | 'NEGATIVO' | null>(null);
  const [tipoAccionId, setTipoAccionId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const necesitaAccion = resultado !== null && requiereAccionCorrectiva(resultado);

  // Previsualización de la próxima revisión, calculada con la misma regla que el backend.
  const proximaRevision =
    resultado === 'OK' ? calcularProximaRevision(new Date(`${fecha}T00:00:00`), 'OK') : null;

  const puedeGuardar =
    resultado !== null && !guardando && (!necesitaAccion || tipoAccionId !== '');

  async function guardar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    if (!resultado) return;

    setGuardando(true);
    setError(null);

    try {
      await api.registrarMantenimiento({
        valvulaId: valvula.id,
        fecha: aIsoCompleto(fecha),
        engraseRealizado: engrase,
        resultadoPrueba: resultado,
        tipoAccionId: necesitaAccion ? tipoAccionId : undefined,
        observaciones: observaciones.trim() || undefined,
      });

      onGuardado();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar el mantenimiento.');
      setGuardando(false);
    }
  }

  return (
    <div className="fondo-modal centrado" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ fontFamily: 'var(--mono)', fontSize: 15 }}>Registrar mantenimiento</h2>
            <p style={{ fontSize: 12, color: 'var(--texto-tenue)', marginTop: 3 }}>
              {pozoNombre} · {valvula.codigo} — {valvula.nombre}
              <br />
              Estado actual: {ETIQUETA_ESTADO[valvula.estado]}
            </p>
          </div>
          <button type="button" className="cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </header>

        {error && <div className="error">{error}</div>}

        <form onSubmit={guardar}>
          <div className="campo">
            <label htmlFor="fecha">Fecha del mantenimiento</label>
            <input
              id="fecha"
              type="date"
              value={fecha}
              max={hoyEnIso()}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </div>

          <div className="campo">
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                textTransform: 'none',
                letterSpacing: 0,
                fontSize: 13,
                fontFamily: 'var(--sans)',
                color: 'var(--texto)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={engrase}
                onChange={(e) => setEngrase(e.target.checked)}
              />
              Engrase realizado
            </label>
          </div>

          <div className="campo">
            <label>Resultado de la prueba de hermeticidad</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setResultado('OK')}
                style={{
                  padding: '12px 10px',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 4,
                  border: `1px solid ${resultado === 'OK' ? 'var(--ok)' : 'var(--borde)'}`,
                  background: resultado === 'OK' ? 'rgba(16,185,129,0.18)' : 'var(--fondo)',
                  color: resultado === 'OK' ? 'var(--ok)' : 'var(--texto-tenue)',
                }}
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => setResultado('NEGATIVO')}
                style={{
                  padding: '12px 10px',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 4,
                  border: `1px solid ${resultado === 'NEGATIVO' ? 'var(--falla)' : 'var(--borde)'}`,
                  background: resultado === 'NEGATIVO' ? 'rgba(239,68,68,0.18)' : 'var(--fondo)',
                  color: resultado === 'NEGATIVO' ? 'var(--falla)' : 'var(--texto-tenue)',
                }}
              >
                Negativo
              </button>
            </div>
          </div>

          {necesitaAccion && (
            <div className="campo">
              <BannerSupuesto id="CATALOGO_ACCIONES" />
              <label htmlFor="accion">Acción correctiva (obligatoria)</label>
              <select
                id="accion"
                value={tipoAccionId}
                onChange={(e) => setTipoAccionId(e.target.value)}
                required
              >
                <option value="">Elegir acción…</option>
                {tiposAccion.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {resultado === 'OK' && proximaRevision && (
            <div className="campo">
              <label>Próxima revisión (calculada automáticamente)</label>
              <input
                type="text"
                value={`${proximaRevision.toISOString().slice(0, 10)} (+1 año)`}
                disabled
                style={{ color: 'var(--texto-tenue)' }}
              />
            </div>
          )}

          <div className="campo">
            <label htmlFor="obs">Observaciones (opcional)</label>
            <textarea
              id="obs"
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" className="boton-secundario" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="boton" disabled={!puedeGuardar}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
