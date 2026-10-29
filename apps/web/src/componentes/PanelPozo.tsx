import {
  COLOR_ESTADO,
  ETIQUETA_ESTADO,
  type PozoDetalle,
  type TipoAccionCorrectiva,
} from '@petrolero/shared';
import { useState } from 'react';

import { BannerSupuesto } from './BannerSupuesto';
import { FormularioMantenimiento } from './FormularioMantenimiento';
import { VisorPozo3D } from './visor3d/VisorPozo3D';

interface Props {
  pozo: PozoDetalle;
  tiposAccion: TipoAccionCorrectiva[];
  onCerrar: () => void;
  onActualizar: () => void;
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR');
}

/**
 * Panel deslizable con el detalle de un pozo: visor 3D arriba y tabla de válvulas abajo.
 * La tabla no es decorativa: es la alternativa accesible al 3D para quien prefiera
 * leer los datos, y ambas comparten el mismo estado de selección.
 */
export function PanelPozo({ pozo, tiposAccion, onCerrar, onActualizar }: Props): JSX.Element {
  const [valvulaSeleccionada, setValvulaSeleccionada] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState<string | null>(null);

  const valvula = pozo.valvulas.find((v) => v.id === valvulaSeleccionada) ?? null;
  const valvulaRegistrando = pozo.valvulas.find((v) => v.id === registrando) ?? null;

  return (
    <div className="fondo-modal" onClick={onCerrar}>
      <div className="panel-detalle" onClick={(e) => e.stopPropagation()}>
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: COLOR_ESTADO[pozo.estadoGeneral],
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontFamily: 'var(--mono)', fontSize: 15 }}>{pozo.nombre}</h2>
              <p
                style={{
                  fontSize: 11.5,
                  color: 'var(--texto-tenue)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pozo.zonaNombre} · {pozo.lat.toFixed(4)}, {pozo.lng.toFixed(4)} ·{' '}
                {pozo.valvulas.length} válvulas
              </p>
            </div>
          </div>
          <button type="button" className="cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="cuerpo">
          <BannerSupuesto id="MODELO_3D_VALVULAS" />

          <VisorPozo3D
            valvulas={pozo.valvulas}
            valvulaSeleccionada={valvulaSeleccionada}
            onSeleccionar={setValvulaSeleccionada}
          />

          {valvula && (
            <div className="tarjeta" style={{ marginTop: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h3 style={{ fontFamily: 'var(--mono)', fontSize: 13.5 }}>
                    {valvula.codigo} — {valvula.nombre}
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'var(--texto-tenue)', marginTop: 3 }}>
                    {valvula.orientacion === 'VERTICAL' ? 'Vertical' : 'Horizontal'} ·{' '}
                    <span style={{ color: COLOR_ESTADO[valvula.estado] }}>
                      {ETIQUETA_ESTADO[valvula.estado]}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  className="boton"
                  onClick={() => setRegistrando(valvula.id)}
                >
                  Registrar mantenimiento
                </button>
              </div>

              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 10,
                  marginTop: 12,
                  fontSize: 12,
                }}
              >
                <div>
                  <dt style={{ color: 'var(--texto-tenue)', fontSize: 10.5 }}>Última revisión</dt>
                  <dd style={{ fontFamily: 'var(--mono)' }}>
                    {formatearFecha(valvula.ultimoEvento?.fecha ?? null)}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: 'var(--texto-tenue)', fontSize: 10.5 }}>Resultado</dt>
                  <dd style={{ fontFamily: 'var(--mono)' }}>
                    {valvula.ultimoEvento?.resultadoPrueba ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: 'var(--texto-tenue)', fontSize: 10.5 }}>Próxima revisión</dt>
                  <dd style={{ fontFamily: 'var(--mono)' }}>
                    {formatearFecha(valvula.ultimoEvento?.proximaRevision ?? null)}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: 'var(--texto-tenue)', fontSize: 10.5 }}>Acción pendiente</dt>
                  <dd style={{ fontFamily: 'var(--mono)' }}>
                    {valvula.accionPendiente?.tipoNombre ?? 'Ninguna'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <h3
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--texto-tenue)',
              margin: '18px 0 8px',
            }}
          >
            Listado de válvulas
          </h3>

          <div style={{ overflowX: 'auto', border: '1px solid var(--borde)', borderRadius: 6 }}>
            <table>
              <thead>
                <tr>
                  <th>Válvula</th>
                  <th>Orient.</th>
                  <th>Estado</th>
                  <th>Últ. rev.</th>
                  <th>Próx. rev.</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pozo.valvulas.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => setValvulaSeleccionada(v.id)}
                    style={{
                      cursor: 'pointer',
                      background:
                        v.id === valvulaSeleccionada ? 'var(--superficie-2)' : undefined,
                    }}
                  >
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: COLOR_ESTADO[v.estado],
                          marginRight: 7,
                        }}
                      />
                      {v.codigo} {v.nombre}
                    </td>
                    <td>{v.orientacion === 'VERTICAL' ? 'Vert.' : 'Horiz.'}</td>
                    <td>
                      <span
                        className="chip"
                        style={{
                          background: `${COLOR_ESTADO[v.estado]}22`,
                          color: COLOR_ESTADO[v.estado],
                        }}
                      >
                        {ETIQUETA_ESTADO[v.estado]}
                      </span>
                    </td>
                    <td>{formatearFecha(v.ultimoEvento?.fecha ?? null)}</td>
                    <td>{formatearFecha(v.ultimoEvento?.proximaRevision ?? null)}</td>
                    <td>{v.accionPendiente?.tipoNombre ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {valvulaRegistrando && (
        <FormularioMantenimiento
          valvula={valvulaRegistrando}
          pozoNombre={pozo.nombre}
          tiposAccion={tiposAccion}
          onCerrar={() => setRegistrando(null)}
          onGuardado={() => {
            setRegistrando(null);
            onActualizar();
          }}
        />
      )}
    </div>
  );
}
