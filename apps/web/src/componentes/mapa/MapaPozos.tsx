import { COLOR_ESTADO, type PozoResumen, type ZonaResumen } from '@petrolero/shared';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';

import { ESTILO_MAPA, VISTA_INICIAL } from './estiloMapa';

interface Props {
  zonas: ZonaResumen[];
  pozos: PozoResumen[];
  /** Zona cuyos pozos se están mostrando. null = vista de zonas agrupadas. */
  zonaSeleccionada: string | null;
  onSeleccionarZona: (zonaId: string) => void;
  onSeleccionarPozo: (pozoId: string) => void;
  onVolverAZonas: () => void;
}

/**
 * Mapa interactivo con drill-down en dos niveles:
 *   1. Zonas agrupadas, cada una con su cantidad de pozos.
 *   2. Al hacer click en una zona, el mapa vuela hasta ella y despliega
 *      LOS PINES DE CADA POZO SOBRE EL MAPA.
 *
 * Esto último es lo que pidió el cliente y lo que faltaba en el export de diseño:
 * ahí los círculos de zona solo filtraban una lista lateral, y el pozo se elegía
 * desde esa lista, no desde el mapa.
 */
export function MapaPozos({
  zonas,
  pozos,
  zonaSeleccionada,
  onSeleccionarZona,
  onSeleccionarPozo,
  onVolverAZonas,
}: Props): JSX.Element {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const marcadores = useRef<maplibregl.Marker[]>([]);

  /**
   * El mapa está listo para recibir marcadores.
   *
   * Es estado de React y no una consulta a `isStyleLoaded()` por un motivo concreto: antes
   * el efecto de marcadores hacía `once('load')` cuando el estilo todavía no estaba listo.
   * Si ese listener quedaba enganchado a una instancia que después se destruía (React
   * StrictMode monta, desmonta y vuelve a montar), nunca se disparaba, y como las
   * dependencias del efecto no cambiaban, los marcadores no se dibujaban nunca.
   * Resultado: el mapa aparecía vacío de forma intermitente.
   */
  const [mapaListo, setMapaListo] = useState(false);

  /** Mensaje de error del mapa, para no dejar un rectángulo vacío sin explicación. */
  const [errorMapa, setErrorMapa] = useState<string | null>(null);

  // Los handlers se guardan en refs para que el efecto que dibuja marcadores no
  // dependa de su identidad y vuelva a correr en cada render del padre.
  const alSeleccionarZona = useRef(onSeleccionarZona);
  const alSeleccionarPozo = useRef(onSeleccionarPozo);
  alSeleccionarZona.current = onSeleccionarZona;
  alSeleccionarPozo.current = onSeleccionarPozo;

  // Creación del mapa: una sola vez.
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;

    mapa.current = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO_MAPA,
      center: VISTA_INICIAL.center,
      zoom: VISTA_INICIAL.zoom,
      attributionControl: { compact: true },
    });

    mapa.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    const instancia = mapa.current;
    instancia.on('load', () => setMapaListo(true));

    // Sin esto, un estilo inválido o un proveedor de tiles caído dejan el mapa en blanco
    // sin ningún aviso: ni en consola ni en pantalla.
    instancia.on('error', (evento) => {
      const mensaje = evento.error?.message ?? 'Error desconocido del mapa';
      console.error('[MapaPozos]', mensaje, evento.error);
      setErrorMapa(mensaje);
    });

    /**
     * El canvas de MapLibre no se adapta solo al contenedor: hay que avisarle.
     * Sin esto, al cambiar el tamaño de la ventana (o al pasar de mobile a escritorio)
     * el canvas conservaba las medidas viejas y el mapa quedaba dibujado en un rincón.
     */
    const observador = new ResizeObserver(() => instancia.resize());
    if (contenedor.current) observador.observe(contenedor.current);

    return () => {
      observador.disconnect();
      instancia.remove();
      mapa.current = null;
      setMapaListo(false);
    };
  }, []);

  // Redibuja los marcadores cuando el mapa está listo o cambian el nivel o los datos.
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia || !mapaListo) return;

    const dibujar = (): void => {
      // Limpia los marcadores del nivel anterior antes de dibujar el nuevo.
      marcadores.current.forEach((m) => m.remove());
      marcadores.current = [];

      if (zonaSeleccionada === null) {
        for (const zona of zonas) {
          const elemento = document.createElement('div');
          elemento.className = 'marcador-zona';
          elemento.style.background = COLOR_ESTADO[zona.estadoGeneral];
          elemento.textContent = String(zona.cantidadPozos);
          elemento.title = `${zona.nombre} — ${zona.cantidadPozos} pozos (click para ver los pozos)`;
          elemento.addEventListener('click', (evento) => {
            evento.stopPropagation();
            alSeleccionarZona.current(zona.id);
          });

          marcadores.current.push(
            new maplibregl.Marker({ element: elemento })
              .setLngLat([zona.lng, zona.lat])
              .addTo(instancia),
          );
        }
        return;
      }

      // Nivel 2: un pin por pozo, coloreado según su peor válvula.
      for (const pozo of pozos) {
        const elemento = document.createElement('div');
        elemento.className = 'marcador-pozo';
        elemento.style.background = COLOR_ESTADO[pozo.estadoGeneral];
        elemento.textContent = String(pozo.cantidadValvulas);
        elemento.title = `${pozo.nombre} — ${pozo.cantidadValvulas} válvulas, ${pozo.accionesPendientes} acciones pendientes`;
        elemento.addEventListener('click', (evento) => {
          evento.stopPropagation();
          alSeleccionarPozo.current(pozo.id);
        });

        marcadores.current.push(
          new maplibregl.Marker({ element: elemento })
            .setLngLat([pozo.lng, pozo.lat])
            .addTo(instancia),
        );
      }
    };

    dibujar();
  }, [zonas, pozos, zonaSeleccionada, mapaListo]);

  // Encuadre: al entrar a una zona vuela a sus pozos; al volver, muestra todo el país.
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;

    if (zonaSeleccionada === null) {
      instancia.flyTo({ center: VISTA_INICIAL.center, zoom: VISTA_INICIAL.zoom, duration: 700 });
      return;
    }

    if (pozos.length === 0) return;

    const limites = new maplibregl.LngLatBounds();
    pozos.forEach((p) => limites.extend([p.lng, p.lat]));
    instancia.fitBounds(limites, { padding: 90, maxZoom: 11, duration: 700 });
  }, [zonaSeleccionada, pozos]);

  return (
    <div className="mapa-contenedor">
      <div ref={contenedor} className="mapa" />

      {zonaSeleccionada !== null && (
        <button type="button" className="volver-zonas" onClick={onVolverAZonas}>
          ← Volver a todas las zonas
        </button>
      )}

      {errorMapa && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 6,
            maxWidth: '85%',
            padding: '9px 13px',
            background: 'rgba(239,68,68,0.14)',
            border: '1px solid rgba(239,68,68,0.45)',
            borderRadius: 5,
            color: '#fca5a5',
            fontSize: 12,
          }}
        >
          No se pudo cargar el mapa: {errorMapa}. Los pozos siguen disponibles en el listado
          lateral.
        </div>
      )}

      <div className="leyenda">
        <span>
          <i style={{ background: COLOR_ESTADO.OK }} /> Operativa
        </span>
        <span>
          <i style={{ background: COLOR_ESTADO.POR_VENCER }} /> Por vencer
        </span>
        <span>
          <i style={{ background: COLOR_ESTADO.FALLA }} /> Requiere acción
        </span>
      </div>
    </div>
  );
}
