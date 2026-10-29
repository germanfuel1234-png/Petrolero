import { describe, expect, it } from 'vitest';

import { ImportadorService } from './importador.service';

/**
 * Tests de las funciones de interpretación del importador.
 * Se accede a los métodos privados a propósito: son donde vive la lógica riesgosa
 * (fechas ambiguas, coordenadas inválidas) y merecen cobertura directa.
 */
const servicio = new ImportadorService(null as never);
const interno = servicio as unknown as {
  aFecha(valor: string | undefined): Date | null;
  aNumero(valor: string | undefined): number | null;
  validarCoordenadas(
    lat: number | null,
    lng: number | null,
  ): { valida: boolean; motivo?: string };
};

describe('aFecha — formato argentino', () => {
  it('interpreta 03/04/2026 como 3 de ABRIL, no 4 de marzo', () => {
    // Este es el caso que antes se corrompía en silencio: new Date("03/04/2026")
    // devuelve el 4 de marzo porque asume formato estadounidense.
    const fecha = interno.aFecha('03/04/2026');

    expect(fecha).not.toBeNull();
    expect(fecha!.getDate()).toBe(3);
    expect(fecha!.getMonth()).toBe(3); // abril
    expect(fecha!.getFullYear()).toBe(2026);
  });

  it('interpreta 01/02/2026 como 1 de febrero', () => {
    const fecha = interno.aFecha('01/02/2026');

    expect(fecha!.getDate()).toBe(1);
    expect(fecha!.getMonth()).toBe(1); // febrero
  });

  it('acepta día mayor a 12 sin ambigüedad', () => {
    const fecha = interno.aFecha('25/12/2026');

    expect(fecha!.getDate()).toBe(25);
    expect(fecha!.getMonth()).toBe(11); // diciembre
  });

  it('acepta guiones además de barras', () => {
    const fecha = interno.aFecha('15-08-2026');

    expect(fecha!.getDate()).toBe(15);
    expect(fecha!.getMonth()).toBe(7); // agosto
  });

  it('sigue aceptando formato ISO', () => {
    const fecha = interno.aFecha('2026-04-03');

    expect(fecha!.getFullYear()).toBe(2026);
    expect(fecha!.getMonth()).toBe(3);
  });

  it('rechaza fechas que no existen en el calendario', () => {
    // JS desborda 31/02 al 2 o 3 de marzo; acá tiene que dar null.
    expect(interno.aFecha('31/02/2026')).toBeNull();
    expect(interno.aFecha('30/02/2026')).toBeNull();
  });

  it('rechaza un mes inválido', () => {
    expect(interno.aFecha('10/13/2026')).toBeNull();
  });

  it('devuelve null para texto que no es fecha', () => {
    expect(interno.aFecha('mañana')).toBeNull();
    expect(interno.aFecha('')).toBeNull();
    expect(interno.aFecha(undefined)).toBeNull();
  });
});

describe('aNumero — decimales en formato español', () => {
  it('acepta coma como separador decimal', () => {
    expect(interno.aNumero('-38,50')).toBeCloseTo(-38.5);
  });

  it('acepta punto', () => {
    expect(interno.aNumero('-38.50')).toBeCloseTo(-38.5);
  });

  it('devuelve null para texto no numérico', () => {
    expect(interno.aNumero('norte')).toBeNull();
    expect(interno.aNumero(undefined)).toBeNull();
  });
});

describe('validarCoordenadas', () => {
  it('acepta coordenadas de Argentina', () => {
    expect(interno.validarCoordenadas(-38.4, -68.9).valida).toBe(true);
  });

  it('rechaza una latitud imposible', () => {
    const resultado = interno.validarCoordenadas(-999, -68);

    expect(resultado.valida).toBe(false);
    expect(resultado.motivo).toContain('latitud fuera de rango');
  });

  it('rechaza una longitud imposible', () => {
    const resultado = interno.validarCoordenadas(-38, 9999);

    expect(resultado.valida).toBe(false);
    expect(resultado.motivo).toContain('longitud fuera de rango');
  });

  it('marca como no válida la coordenada ausente, pero sin motivo de error', () => {
    // Sin coordenadas el pozo se crea igual (con advertencia); con coordenadas
    // imposibles se rechaza la fila. Por eso se distinguen los dos casos.
    const resultado = interno.validarCoordenadas(null, null);

    expect(resultado.valida).toBe(false);
    expect(resultado.motivo).toBeUndefined();
  });

  it('acepta los límites exactos', () => {
    expect(interno.validarCoordenadas(-90, -180).valida).toBe(true);
    expect(interno.validarCoordenadas(90, 180).valida).toBe(true);
  });
});
