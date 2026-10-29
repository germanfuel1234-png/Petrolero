import { useEffect, useState } from 'react';

import { api, type AccionPendienteAgrupada } from '../api';
import { BannerSupuesto } from '../componentes/BannerSupuesto';

/**
 * Acciones correctivas pendientes agrupadas por tipo.
 * Es la vista que pidió el cliente: "me dan a todos, todos estos pozos necesitan lavado".
 * Permite seleccionar varias y mandarlas juntas a un plan semanal.
 */
export function VistaAcciones({
  seleccionadas,
  onCambiarSeleccion,
  onIrAPlanificador,
}: {
  seleccionadas: Set<string>;
  onCambiarSeleccion: (ids: Set<string>) => void;
  onIrAPlanificador: () => void;
}): JSX.Element {
  const [grupos, setGrupos] = useState<AccionPendienteAgrupada[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .accionesPendientes()
      .then(setGrupos)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'));
  }, []);

  function alternar(accionId: string): void {
    const copia = new Set(seleccionadas);
    if (copia.has(accionId)) copia.delete(accionId);
    else copia.add(accionId);
    onCambiarSeleccion(copia);
  }

  function alternarGrupo(grupo: AccionPendienteAgrupada): void {
    const disponibles = grupo.items.filter((i) => !i.planSemanalId).map((i) => i.accionId);
    const todasElegidas = disponibles.every((id) => seleccionadas.has(id));

    const copia = new Set(seleccionadas);
    disponibles.forEach((id) => (todasElegidas ? copia.delete(id) : copia.add(id)));
    onCambiarSeleccion(copia);
  }

  if (error) return <div className="vista"><div className="error">{error}</div></div>;
  if (!grupos) return <div className="vista"><div className="cargando">Cargando acciones…</div></div>;

  const totalPendientes = grupos.reduce((suma, g) => suma + g.items.length, 0);

  return (
    <div className="vista">
      <h1>Acciones correctivas pendientes</h1>
      <p className="subtitulo">
        {totalPendientes} válvulas con prueba negativa, agrupadas por tipo de intervención.
      </p>

      <BannerSupuesto id="CATALOGO_ACCIONES" />

      {seleccionadas.size > 0 && (
        <div
          className="tarjeta"
          style={{
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            borderColor: 'var(--marca)',
          }}
        >
          <span style={{ fontSize: 13 }}>
            <strong>{seleccionadas.size}</strong> acciones seleccionadas
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="boton-secundario"
              onClick={() => onCambiarSeleccion(new Set())}
            >
              Limpiar
            </button>
            <button type="button" className="boton" onClick={onIrAPlanificador}>
              Armar plan semanal
            </button>
          </div>
        </div>
      )}

      {totalPendientes === 0 ? (
        <div className="vacio">No hay acciones correctivas pendientes.</div>
      ) : (
        <div className="grilla">
          {grupos.map((grupo) => (
            <div key={grupo.tipoAccionId} className="tarjeta">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  paddingBottom: 10,
                  marginBottom: 10,
                  borderBottom: '1px solid var(--borde)',
                }}
              >
                <h2 style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{grupo.tipoNombre}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="chip" style={{ background: 'var(--superficie-2)', color: 'var(--texto-tenue)' }}>
                    {grupo.items.length}
                  </span>
                  <button
                    type="button"
                    className="boton-secundario"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={() => alternarGrupo(grupo)}
                  >
                    Todas
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grupo.items.map((item) => {
                  const yaPlanificada = item.planSemanalId !== null;

                  return (
                    <label
                      key={item.accionId}
                      style={{
                        display: 'flex',
                        gap: 9,
                        padding: 9,
                        background: 'var(--fondo)',
                        border: '1px solid var(--borde)',
                        borderRadius: 4,
                        cursor: yaPlanificada ? 'default' : 'pointer',
                        opacity: yaPlanificada ? 0.55 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={seleccionadas.has(item.accionId)}
                        disabled={yaPlanificada}
                        onChange={() => alternar(item.accionId)}
                        style={{ marginTop: 2 }}
                      />
                      <span style={{ fontSize: 12, minWidth: 0 }}>
                        <strong style={{ fontFamily: 'var(--mono)' }}>
                          {item.pozoNombre} / {item.valvulaCodigo}
                        </strong>
                        <br />
                        <span style={{ color: 'var(--texto-tenue)', fontSize: 11 }}>
                          {item.zonaNombre}
                        </span>
                        <br />
                        <span style={{ color: 'var(--texto-tenue)', fontSize: 10.5 }}>
                          Detectado hace {item.diasPendiente} días
                          {yaPlanificada && ' · ya planificada'}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
