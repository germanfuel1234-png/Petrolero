import type { StyleSpecification } from 'maplibre-gl';

/**
 * Estilo de mapa con tiles raster de OpenStreetMap.
 *
 * TODO[CLIENTE]: OSM no da garantía de servicio para uso productivo. Para producción
 * conviene un proveedor con SLA (MapTiler, Mapbox) o un servidor de tiles propio.
 * Cambiando solo este archivo se reemplaza la fuente: el resto del mapa no se toca.
 */
export const ESTILO_MAPA: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap',
      maxzoom: 19,
    },
  },
  layers: [
    {
      // Fondo oscuro debajo del raster: evita el flash blanco mientras cargan los tiles.
      id: 'fondo',
      type: 'background',
      paint: { 'background-color': '#05070d' },
    },
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
      paint: {
        // Los tiles de OSM son claros; se oscurecen para integrarlos al tema industrial.
        'raster-brightness-max': 0.45,
        'raster-saturation': -0.6,
        'raster-contrast': 0.15,
      },
    },
  ],
};

/** Encuadre inicial: Argentina productiva completa, de Cuyo a Tierra del Fuego. */
export const VISTA_INICIAL = {
  center: [-68.5, -42.0] as [number, number],
  zoom: 3.6,
};
