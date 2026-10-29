import { describe, expect, it } from 'vitest';

import {
  calcularProximaRevision,
  derivarEstadoValvula,
  peorEstado,
  requiereAccionCorrectiva,
} from '@petrolero/shared';

describe('calcularProximaRevision', () => {
  it('agenda la próxima revisión exactamente a 1 año cuando la prueba da OK', () => {
    const resultado = calcularProximaRevision(new Date('2026-03-15T00:00:00'), 'OK');

    expect(resultado).not.toBeNull();
    expect(resultado!.getFullYear()).toBe(2027);
    expect(resultado!.getMonth()).toBe(2); // marzo
    expect(resultado!.getDate()).toBe(15);
  });

  it('no agenda próxima revisión cuando la prueba da NEGATIVO', () => {
    // La válvula tiene que repararse primero: recién ahí se vuelve a probar.
    expect(calcularProximaRevision(new Date('2026-03-15'), 'NEGATIVO')).toBeNull();
  });

  it('maneja el 29 de febrero sin generar una fecha inválida', () => {
    const resultado = calcularProximaRevision(new Date('2024-02-29T00:00:00'), 'OK');

    expect(resultado).not.toBeNull();
    expect(Number.isNaN(resultado!.getTime())).toBe(false);
    // 2025 no es bisiesto: JS normaliza al 1 de marzo.
    expect(resultado!.getFullYear()).toBe(2025);
  });

  it('no modifica la fecha original que recibe', () => {
    const original = new Date('2026-03-15T00:00:00');
    calcularProximaRevision(original, 'OK');

    expect(original.getFullYear()).toBe(2026);
  });
});

describe('requiereAccionCorrectiva', () => {
  it('exige acción correctiva solo cuando el resultado es NEGATIVO', () => {
    expect(requiereAccionCorrectiva('NEGATIVO')).toBe(true);
    expect(requiereAccionCorrectiva('OK')).toBe(false);
  });
});

describe('derivarEstadoValvula', () => {
  const hoy = new Date('2026-06-15T00:00:00');

  it('devuelve SIN_DATOS si nunca se le registró un mantenimiento', () => {
    expect(derivarEstadoValvula(null, false, hoy)).toBe('SIN_DATOS');
  });

  it('devuelve OK cuando la próxima revisión está lejos', () => {
    const estado = derivarEstadoValvula(
      { resultadoPrueba: 'OK', proximaRevision: '2027-01-01T00:00:00' },
      false,
      hoy,
    );

    expect(estado).toBe('OK');
  });

  it('devuelve POR_VENCER dentro de la ventana de 30 días', () => {
    const estado = derivarEstadoValvula(
      { resultadoPrueba: 'OK', proximaRevision: '2026-07-01T00:00:00' },
      false,
      hoy,
    );

    expect(estado).toBe('POR_VENCER');
  });

  it('devuelve FALLA si la revisión ya venció', () => {
    const estado = derivarEstadoValvula(
      { resultadoPrueba: 'OK', proximaRevision: '2026-01-01T00:00:00' },
      false,
      hoy,
    );

    expect(estado).toBe('FALLA');
  });

  it('devuelve FALLA cuando la última prueba fue negativa', () => {
    const estado = derivarEstadoValvula(
      { resultadoPrueba: 'NEGATIVO', proximaRevision: null },
      true,
      hoy,
    );

    expect(estado).toBe('FALLA');
  });

  it('una acción pendiente manda sobre una prueba OK vigente', () => {
    // Caso real: se reparó y se volvió a probar OK, pero la acción quedó sin cerrar.
    const estado = derivarEstadoValvula(
      { resultadoPrueba: 'OK', proximaRevision: '2027-01-01T00:00:00' },
      true,
      hoy,
    );

    expect(estado).toBe('FALLA');
  });
});

describe('peorEstado', () => {
  it('el estado del pozo lo define su peor válvula', () => {
    expect(peorEstado(['OK', 'POR_VENCER', 'FALLA'])).toBe('FALLA');
    expect(peorEstado(['OK', 'POR_VENCER'])).toBe('POR_VENCER');
    expect(peorEstado(['OK', 'OK'])).toBe('OK');
  });

  it('un pozo sin válvulas queda SIN_DATOS', () => {
    expect(peorEstado([])).toBe('SIN_DATOS');
  });

  it('SIN_DATOS pesa más que OK pero menos que POR_VENCER', () => {
    // Una válvula sin historial es más preocupante que una al día,
    // pero menos urgente que una por vencer.
    expect(peorEstado(['OK', 'SIN_DATOS'])).toBe('SIN_DATOS');
    expect(peorEstado(['SIN_DATOS', 'POR_VENCER'])).toBe('POR_VENCER');
  });
});
