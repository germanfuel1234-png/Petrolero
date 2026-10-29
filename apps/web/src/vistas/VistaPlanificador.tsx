import type { GrupoSugerido } from '@petrolero/shared';
import { useCallback, useEffect, useState } from 'react';

import { api, type PlanSemanalListado } from '../api';
import { BannerSupuesto } from '../componentes/BannerSupuesto';
import { aIsoCompleto, proximoLunes } from '../fechas';

/**
 * Planificador semanal.
 * Sugiere grupos de pozos cercanos (clustering de PostGIS) para que una cuadrilla
 * resuelva varios en el mismo viaje, y permite confirmar un plan y avisar al equipo.
 */
export function VistaPlanificador({
  accionesSeleccionadas,
  onPlanCreado,
}: {
  accionesSeleccionadas: Set<string>;
  onPlanCreado: () => void;
}): JSX.Element {
  const [grupos, setGrupos] = useState<GrupoSugerido[] | null>(null);
  const [planes, setPlanes] = useState<PlanSemanalListado[]>([]);
  const [nombre, setNombre] = useState('Plan de mantenimiento');
  const [semana, setSemana] = useState(proximoLunes());
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [sugerencias, listaPlanes] = await Promise.all([api.sugerencias(), api.planes()]);
      setGrupos(sugerencias);
      setPlanes(listaPlanes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar la planificación');
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function crearPlan(): Promise<void> {
    if (accionesSeleccionadas.size === 0) return;

    setOcupado(true);
    setError(null);

    try {
      const creado = await api.crearPlan({
        nombre,
        semanaInicio: aIsoCompleto(semana),
        accionIds: [...accionesSeleccionadas],
      });

      setMensaje(`Plan "${creado.nombre}" creado con ${creado.accionesAsignadas} tareas.`);
      onPlanCreado();
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el plan');
    } finally {
      setOcupado(false);
    }
  }

  async function notificar(planId: string): Promise<void> {
    setOcupado(true);
    setError(null);

    try {
      const resultado = await api.notificarPlan(planId);
      setMensaje(`Aviso enviado: ${resultado.tareasNotificadas} tareas notificadas al equipo.`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo notificar el plan');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="vista">
      <h1>Planificador semanal</h1>
      <p className="subtitulo">
        Grupos de pozos cercanos sugeridos automáticamente, para optimizar los viajes de las
        cuadrillas.
      </p>

      <BannerSupuesto id="CRITERIO_AGRUPAMIENTO" />

      {error && <div className="error">{error}</div>}
      {mensaje && (
        <div
          className="tarjeta"
          style={{ marginBottom: 14, borderColor: 'var(--ok)', color: 'var(--ok)', fontSize: 12.5 }}
        >
          {mensaje}
        </div>
      )}

      <div className="tarjeta" style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: 'var(--mono)', fontSize: 13, marginBottom: 12 }}>
          Crear plan con las acciones seleccionadas ({accionesSeleccionadas.size})
        </h2>

        {accionesSeleccionadas.size === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--texto-tenue)' }}>
            No hay acciones seleccionadas. Elegilas en la pantalla de{' '}
            <strong>Acciones pendientes</strong> y volvé acá.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="campo" style={{ flex: '1 1 220px', marginBottom: 0 }}>
              <label htmlFor="nombre-plan">Nombre del plan</label>
              <input
                id="nombre-plan"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="campo" style={{ flex: '0 1 180px', marginBottom: 0 }}>
              <label htmlFor="semana">Semana (lunes)</label>
              <input
                id="semana"
                type="date"
                value={semana}
                onChange={(e) => setSemana(e.target.value)}
              />
            </div>
            <button type="button" className="boton" onClick={crearPlan} disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Crear plan'}
            </button>
          </div>
        )}
      </div>

      <h2
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--texto-tenue)',
          marginBottom: 10,
        }}
      >
        Grupos sugeridos por cercanía
      </h2>

      {!grupos ? (
        <div className="cargando">Calculando agrupamiento…</div>
      ) : grupos.length === 0 ? (
        <div className="vacio">No hay pozos con acciones pendientes sin planificar.</div>
      ) : (
        <div className="grilla" style={{ marginBottom: 22 }}>
          {grupos.slice(0, 9).map((grupo) => (
            <div key={grupo.grupo} className="tarjeta">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 9,
                }}
              >
                <h3 style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>
                  Grupo {grupo.grupo + 1}
                </h3>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--texto-tenue)' }}>
                  {grupo.pozos.length} pozos · {grupo.distanciaMaxKm} km entre extremos
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {grupo.pozos.map((pozo) => (
                  <div
                    key={pozo.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11.5,
                      padding: '5px 8px',
                      background: 'var(--fondo)',
                      border: '1px solid var(--borde)',
                      borderRadius: 3,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--mono)' }}>{pozo.nombre}</span>
                    <span style={{ color: 'var(--aviso)' }}>
                      {pozo.accionesPendientes} pendientes
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--texto-tenue)',
          marginBottom: 10,
        }}
      >
        Planes creados
      </h2>

      <BannerSupuesto id="CANAL_NOTIFICACION" />

      {planes.length === 0 ? (
        <div className="vacio">Todavía no se creó ningún plan.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {planes.map((plan) => (
            <div key={plan.id} className="tarjeta">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h3 style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{plan.nombre}</h3>
                  <p style={{ fontSize: 11.5, color: 'var(--texto-tenue)', marginTop: 3 }}>
                    Semana del {plan.semanaInicio} · {plan.cantidadAcciones} tareas ·{' '}
                    {plan.notificadoEn
                      ? `notificado el ${new Date(plan.notificadoEn).toLocaleDateString('es-AR')}`
                      : 'sin notificar'}
                  </p>
                </div>
                <button
                  type="button"
                  className={plan.notificadoEn ? 'boton-secundario' : 'boton'}
                  onClick={() => notificar(plan.id)}
                  disabled={ocupado}
                >
                  {plan.notificadoEn ? 'Volver a notificar' : 'Notificar al equipo'}
                </button>
              </div>

              {plan.acciones.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  {plan.acciones.map((accion) => (
                    <span
                      key={accion.id}
                      className="chip"
                      style={{ background: 'var(--superficie-2)', color: 'var(--texto-tenue)' }}
                    >
                      {accion.pozoNombre}/{accion.valvulaCodigo}: {accion.tipoNombre}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
