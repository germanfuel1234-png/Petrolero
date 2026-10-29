import {
  COLOR_ESTADO,
  ETIQUETA_ESTADO,
  type PozoResumen,
  type ZonaResumen,
} from '@petrolero/shared';
import { useMemo, useState } from 'react';

import { BannerSupuesto } from '../componentes/BannerSupuesto';
import { MapaPozos } from '../componentes/mapa/MapaPozos';

interface Props {
  zonas: ZonaResumen[];
  pozos: PozoResumen[];
  zonaSeleccionada: string | null;
  onSeleccionarZona: (zonaId: string | null) => void;
  onAbrirPozo: (pozoId: string) => void;
}

/**
 * Pantalla principal: mapa a la derecha y panel de filtros/listado a la izquierda.
 * El listado acompaña al mapa (ambos reflejan la misma selección), pero el camino
 * principal de navegación es el mapa, como pidió el cliente.
 */
export function VistaMapa({
  zonas,
  pozos,
  zonaSeleccionada,
  onSeleccionarZona,
  onAbrirPozo,
}: Props): JSX.Element {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'OK' | 'POR_VENCER' | 'FALLA'>(
    'TODOS',
  );

  const pozosVisibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return pozos.filter((pozo) => {
      const coincideTexto = termino === '' || pozo.nombre.toLowerCase().includes(termino);
      const coincideEstado = filtroEstado === 'TODOS' || pozo.estadoGeneral === filtroEstado;
      return coincideTexto && coincideEstado;
    });
  }, [pozos, busqueda, filtroEstado]);

  const zona = zonas.find((z) => z.id === zonaSeleccionada) ?? null;

  return (
    <div className="mapa-layout">
      <aside className="panel-lateral">
        <BannerSupuesto id="COORDENADAS_POZOS" />

        <div className="campo">
          <label htmlFor="buscar">Buscar pozo</label>
          <input
            id="buscar"
            type="search"
            placeholder="Ej. LC-1035"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="zona">Zona</label>
          <select
            id="zona"
            value={zonaSeleccionada ?? ''}
            onChange={(e) => onSeleccionarZona(e.target.value || null)}
          >
            <option value="">Todas las zonas</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre} ({z.cantidadPozos})
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label>Estado</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {(['TODOS', 'OK', 'POR_VENCER', 'FALLA'] as const).map((estado) => (
              <button
                key={estado}
                type="button"
                onClick={() => setFiltroEstado(estado)}
                style={{
                  padding: '6px 8px',
                  fontSize: 11,
                  borderRadius: 4,
                  border: `1px solid ${filtroEstado === estado ? 'var(--marca)' : 'var(--borde)'}`,
                  background: filtroEstado === estado ? 'var(--superficie-2)' : 'var(--fondo)',
                  color: filtroEstado === estado ? 'var(--texto)' : 'var(--texto-tenue)',
                }}
              >
                {estado === 'TODOS' ? 'Todos' : ETIQUETA_ESTADO[estado]}
              </button>
            ))}
          </div>
        </div>

        <h2
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--texto-tenue)',
            margin: '16px 0 8px',
          }}
        >
          {zona ? `Pozos de ${zona.nombre}` : 'Todos los pozos'} ({pozosVisibles.length})
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pozosVisibles.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>
              Ningún pozo coincide con el filtro.
            </p>
          )}

          {pozosVisibles.map((pozo) => (
            <button
              key={pozo.id}
              type="button"
              onClick={() => onAbrirPozo(pozo.id)}
              style={{
                textAlign: 'left',
                padding: 9,
                background: 'var(--fondo)',
                border: '1px solid var(--borde)',
                borderRadius: 4,
                color: 'var(--texto)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: COLOR_ESTADO[pozo.estadoGeneral],
                      marginRight: 6,
                    }}
                  />
                  {pozo.nombre}
                </span>
                <span style={{ fontSize: 10, color: 'var(--texto-tenue)' }}>
                  {pozo.cantidadValvulas} válvulas
                </span>
              </div>
              {pozo.accionesPendientes > 0 && (
                <div style={{ fontSize: 10.5, color: 'var(--aviso)', marginTop: 4 }}>
                  {pozo.accionesPendientes} acciones pendientes
                </div>
              )}
            </button>
          ))}
        </div>
      </aside>

      <MapaPozos
        zonas={zonas}
        pozos={pozosVisibles}
        zonaSeleccionada={zonaSeleccionada}
        onSeleccionarZona={(id) => onSeleccionarZona(id)}
        onSeleccionarPozo={onAbrirPozo}
        onVolverAZonas={() => onSeleccionarZona(null)}
      />
    </div>
  );
}
