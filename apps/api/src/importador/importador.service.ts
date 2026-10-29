import { Injectable, Logger } from '@nestjs/common';
import { calcularProximaRevision } from '@petrolero/shared';
import * as XLSX from 'xlsx';

import { PrismaService } from '../prisma/prisma.service';
import {
  CampoImportacion,
  MAPEO_COLUMNAS,
  ORIENTACIONES_ACEPTADAS,
  RESULTADOS_ACEPTADOS,
  normalizar,
} from './mapeo-columnas';

export interface ErrorFila {
  fila: number;
  motivo: string;
  contenido?: string;
}

export interface ReporteImportacion {
  filasLeidas: number;
  filasImportadas: number;
  errores: ErrorFila[];
  /** Columnas del mapeo que no se encontraron en el archivo. */
  columnasNoEncontradas: string[];
  creados: {
    zonas: number;
    pozos: number;
    valvulas: number;
    eventos: number;
    acciones: number;
  };
  advertencias: string[];
}

/** Fila ya traducida del Excel a nuestros campos. */
type FilaNormalizada = Partial<Record<CampoImportacion, string>>;

@Injectable()
export class ImportadorService {
  private readonly logger = new Logger(ImportadorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Procesa un Excel/CSV y carga zonas, pozos, válvulas e historial.
   *
   * El importador no conoce ningún nombre de columna: todo sale de MAPEO_COLUMNAS.
   * Cuando llegue el Excel real del cliente se ajusta ese archivo, no este.
   *
   * Es idempotente a nivel entidad: si un pozo o válvula ya existe lo reutiliza en vez
   * de duplicarlo, así se puede reimportar un archivo corregido sin ensuciar la base.
   */
  async importar(buffer: Buffer, opciones: { simular?: boolean } = {}): Promise<ReporteImportacion> {
    const reporte: ReporteImportacion = {
      filasLeidas: 0,
      filasImportadas: 0,
      errores: [],
      columnasNoEncontradas: [],
      creados: { zonas: 0, pozos: 0, valvulas: 0, eventos: 0, acciones: 0 },
      advertencias: [],
    };

    const libro = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const primeraHoja = libro.SheetNames[0];

    if (!primeraHoja) {
      reporte.errores.push({ fila: 0, motivo: 'El archivo no tiene ninguna hoja.' });
      return reporte;
    }

    const filasCrudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      libro.Sheets[primeraHoja],
      { defval: null, raw: false },
    );

    reporte.filasLeidas = filasCrudas.length;

    if (filasCrudas.length === 0) {
      reporte.errores.push({ fila: 0, motivo: 'La hoja no tiene filas de datos.' });
      return reporte;
    }

    // Resuelve, una sola vez, qué encabezado real del Excel corresponde a cada campo nuestro.
    const encabezados = Object.keys(filasCrudas[0]);
    const resolucion = this.resolverColumnas(encabezados);
    reporte.columnasNoEncontradas = resolucion.noEncontradas;

    const faltantesObligatorias = resolucion.noEncontradas.filter(
      (campo) => MAPEO_COLUMNAS[campo as CampoImportacion].obligatorio,
    );

    if (faltantesObligatorias.length > 0) {
      reporte.errores.push({
        fila: 0,
        motivo:
          `Faltan columnas obligatorias: ${faltantesObligatorias.join(', ')}. ` +
          `Encabezados encontrados en el archivo: ${encabezados.join(', ')}. ` +
          `Ajustar apps/api/src/importador/mapeo-columnas.ts.`,
      });
      return reporte;
    }

    for (const campo of resolucion.noEncontradas) {
      reporte.advertencias.push(
        `La columna opcional "${campo}" no se encontró: ${MAPEO_COLUMNAS[campo as CampoImportacion].descripcion}`,
      );
    }

    // Cachés para no consultar la base una vez por fila.
    const zonasPorNombre = new Map<string, string>();
    const pozosPorNombre = new Map<string, string>();
    const valvulasPorClave = new Map<string, string>();
    const accionesPorNombre = new Map<string, string>();

    // Tope del día de hoy: las inspecciones no pueden ser futuras.
    const finDeHoy = new Date();
    finDeHoy.setHours(23, 59, 59, 999);

    for (const [indice, filaCruda] of filasCrudas.entries()) {
      // +2 porque la fila 1 son los encabezados y el índice arranca en 0.
      const numeroFila = indice + 2;

      try {
        const fila = this.traducirFila(filaCruda, resolucion.mapa);

        if (!fila.zona || !fila.pozo || !fila.valvula) {
          reporte.errores.push({
            fila: numeroFila,
            motivo: 'Fila incompleta: falta zona, pozo o válvula.',
            contenido: JSON.stringify(filaCruda).slice(0, 160),
          });
          continue;
        }

        // El resultado de la prueba se valida ANTES de bifurcar entre simulación e
        // importación real: si no, la vista previa reportaría más filas válidas de las
        // que después entran de verdad.
        const fechaFila = this.aFecha(fila.fechaMantenimiento);

        // Una fecha que el Excel trae pero no se pudo interpretar es un error, no un dato
        // ausente: si se ignorara en silencio, la válvula quedaría "sin datos" sin motivo.
        if (fila.fechaMantenimiento && !fechaFila) {
          reporte.errores.push({
            fila: numeroFila,
            motivo: `Fecha no reconocida: "${fila.fechaMantenimiento}". Se espera DD/MM/AAAA o AAAA-MM-DD.`,
          });
          continue;
        }

        // Misma regla que el endpoint de registro manual: no se aceptan inspecciones futuras.
        if (fechaFila && fechaFila > finDeHoy) {
          reporte.errores.push({
            fila: numeroFila,
            motivo: `La fecha ${fechaFila.toISOString().slice(0, 10)} es futura. Probable error de tipeo en el año.`,
          });
          continue;
        }

        let resultadoFila: 'OK' | 'NEGATIVO' | null = null;

        if (fechaFila && fila.resultadoPrueba) {
          resultadoFila = this.interpretarResultado(fila.resultadoPrueba);

          if (!resultadoFila) {
            reporte.errores.push({
              fila: numeroFila,
              motivo: `Resultado de prueba no reconocido: "${fila.resultadoPrueba}". Valores aceptados en mapeo-columnas.ts.`,
            });
            continue;
          }
        }

        // Las coordenadas también se validan ANTES de bifurcar: si se validaran recién al
        // crear el pozo, la vista previa daría por buenas filas que la importación real
        // rechaza, que es justo lo que el modo simulación tiene que evitar.
        const lat = this.aNumero(fila.latitud);
        const lng = this.aNumero(fila.longitud);
        const coordenadas = this.validarCoordenadas(lat, lng);

        if (coordenadas.motivo) {
          reporte.errores.push({
            fila: numeroFila,
            motivo: `El pozo "${fila.pozo}" tiene ${coordenadas.motivo}.`,
          });
          continue;
        }

        if (opciones.simular) {
          // Modo vista previa: ya validó la fila, pero no escribe nada en la base.
          if (!coordenadas.valida) {
            reporte.advertencias.push(
              `El pozo "${fila.pozo}" (fila ${numeroFila}) no trae coordenadas válidas: no va a aparecer en el mapa.`,
            );
          }
          reporte.filasImportadas++;
          continue;
        }

        // --- Zona ---
        let zonaId = zonasPorNombre.get(fila.zona);
        if (!zonaId) {
          const existente = await this.prisma.zona.findUnique({ where: { nombre: fila.zona } });
          if (existente) {
            zonaId = existente.id;
          } else {
            const creada = await this.prisma.zona.create({
              data: {
                nombre: fila.zona,
                // Si la primera fila de la zona no trae coordenadas, queda en 0,0 y se
                // corrige al promediar sus pozos más abajo.
                lat: this.aNumero(fila.latitud) ?? 0,
                lng: this.aNumero(fila.longitud) ?? 0,
              },
            });
            zonaId = creada.id;
            reporte.creados.zonas++;
          }
          zonasPorNombre.set(fila.zona, zonaId);
        }

        // --- Pozo ---
        let pozoId = pozosPorNombre.get(fila.pozo);
        if (!pozoId) {
          const existente = await this.prisma.pozo.findUnique({ where: { nombre: fila.pozo } });
          if (existente) {
            pozoId = existente.id;
          } else {
            // lat/lng y su validación ya se resolvieron más arriba, antes de bifurcar
            // entre simulación e importación real.
            if (!coordenadas.valida) {
              // Coordenada ausente o no numérica: el pozo se crea igual, pero avisando.
              reporte.advertencias.push(
                `El pozo "${fila.pozo}" (fila ${numeroFila}) no trae coordenadas válidas: no va a aparecer en el mapa.`,
              );
            }

            const creado = await this.prisma.pozo.create({
              data: {
                nombre: fila.pozo,
                zonaId,
                lat: coordenadas.valida ? lat! : 0,
                lng: coordenadas.valida ? lng! : 0,
              },
            });
            pozoId = creado.id;
            reporte.creados.pozos++;
          }
          pozosPorNombre.set(fila.pozo, pozoId);
        }

        // --- Válvula ---
        const claveValvula = `${pozoId}::${fila.valvula}`;
        let valvulaId = valvulasPorClave.get(claveValvula);
        if (!valvulaId) {
          const existente = await this.prisma.valvula.findUnique({
            where: { pozoId_codigo: { pozoId, codigo: fila.valvula } },
          });

          if (existente) {
            valvulaId = existente.id;
          } else {
            const orientacion = this.interpretarOrientacion(fila.orientacion);

            // El orden dentro de cada orientación lo define cuántas válvulas de esa
            // orientación tiene ya el pozo.
            const yaExistentes = await this.prisma.valvula.count({
              where: { pozoId, orientacion },
            });

            const creada = await this.prisma.valvula.create({
              data: {
                pozoId,
                codigo: fila.valvula,
                nombre: fila.nombreValvula || fila.valvula,
                orientacion,
                orden: yaExistentes,
              },
            });
            valvulaId = creada.id;
            reporte.creados.valvulas++;
          }
          valvulasPorClave.set(claveValvula, valvulaId);
        }

        // --- Evento de mantenimiento (opcional) ---
        // fechaFila y resultadoFila ya vienen validados de más arriba.
        if (fechaFila && resultadoFila) {
          const evento = await this.prisma.eventoMantenimiento.create({
            data: {
              valvulaId,
              fecha: fechaFila,
              engraseRealizado: true,
              resultadoPrueba: resultadoFila,
              proximaRevision: calcularProximaRevision(fechaFila, resultadoFila),
              observaciones: fila.observaciones || null,
              registradoPor: 'importacion-excel',
            },
          });
          reporte.creados.eventos++;

          // Un resultado negativo arrastra acción correctiva.
          if (resultadoFila === 'NEGATIVO') {
            const nombreAccion = fila.accionCorrectiva?.trim() || 'Lavado';

            let tipoAccionId = accionesPorNombre.get(normalizar(nombreAccion));
            if (!tipoAccionId) {
              // Si el Excel trae una acción que no está en el catálogo, se crea sola:
              // el catálogo completo es justamente una de las definiciones pendientes.
              const tipo = await this.prisma.tipoAccionCorrectiva.upsert({
                where: { nombre: nombreAccion },
                update: {},
                create: { nombre: nombreAccion },
              });
              tipoAccionId = tipo.id;
              accionesPorNombre.set(normalizar(nombreAccion), tipoAccionId);
            }

            await this.prisma.accionCorrectiva.create({
              data: { eventoId: evento.id, tipoAccionId, estado: 'PENDIENTE' },
            });
            reporte.creados.acciones++;
          }
        }

        reporte.filasImportadas++;
      } catch (error) {
        reporte.errores.push({
          fila: numeroFila,
          motivo: error instanceof Error ? error.message : 'Error desconocido',
          contenido: JSON.stringify(filaCruda).slice(0, 160),
        });
      }
    }

    if (!opciones.simular) {
      await this.recalcularCentrosDeZona([...zonasPorNombre.values()]);
    }

    this.logger.log(
      `Importación: ${reporte.filasImportadas}/${reporte.filasLeidas} filas, ${reporte.errores.length} errores.`,
    );

    return reporte;
  }

  /** Asocia cada campo nuestro con el encabezado real que trae el archivo. */
  private resolverColumnas(encabezados: string[]): {
    mapa: Map<CampoImportacion, string>;
    noEncontradas: string[];
  } {
    const normalizados = new Map(encabezados.map((h) => [normalizar(h), h]));
    const mapa = new Map<CampoImportacion, string>();
    const noEncontradas: string[] = [];

    for (const [campo, definicion] of Object.entries(MAPEO_COLUMNAS)) {
      const encontrada = definicion.columnas
        .map((alias) => normalizados.get(normalizar(alias)))
        .find((valor) => valor !== undefined);

      if (encontrada) {
        mapa.set(campo as CampoImportacion, encontrada);
      } else {
        noEncontradas.push(campo);
      }
    }

    return { mapa, noEncontradas };
  }

  private traducirFila(
    filaCruda: Record<string, unknown>,
    mapa: Map<CampoImportacion, string>,
  ): FilaNormalizada {
    const fila: FilaNormalizada = {};

    for (const [campo, encabezado] of mapa.entries()) {
      const valor = filaCruda[encabezado];
      if (valor !== null && valor !== undefined && String(valor).trim() !== '') {
        fila[campo] = String(valor).trim();
      }
    }

    return fila;
  }

  private interpretarResultado(valor: string): 'OK' | 'NEGATIVO' | null {
    const normalizado = normalizar(valor);
    if ((RESULTADOS_ACEPTADOS.OK as readonly string[]).includes(normalizado)) return 'OK';
    if ((RESULTADOS_ACEPTADOS.NEGATIVO as readonly string[]).includes(normalizado)) {
      return 'NEGATIVO';
    }
    return null;
  }

  private interpretarOrientacion(valor: string | undefined): 'VERTICAL' | 'HORIZONTAL' {
    const normalizado = normalizar(valor);
    if ((ORIENTACIONES_ACEPTADAS.HORIZONTAL as readonly string[]).includes(normalizado)) {
      return 'HORIZONTAL';
    }
    // TODO[SUPUESTO]: si el Excel no indica orientación se asume VERTICAL.
    return 'VERTICAL';
  }

  private aNumero(valor: string | undefined): number | null {
    if (!valor) return null;
    // Tolera decimales con coma, habitual en planillas en español.
    const numero = Number(valor.replace(',', '.'));
    return Number.isFinite(numero) ? numero : null;
  }

  /**
   * Valida que la coordenada sea geográficamente posible.
   * Sin esto, una latitud de -999 o un texto como "norte" terminaban creando el pozo
   * igual: en el primer caso rompe el agrupamiento de PostGIS y en el segundo lo ubica
   * en 0,0 (golfo de Guinea), sin que nadie se entere.
   */
  private validarCoordenadas(
    lat: number | null,
    lng: number | null,
  ): { valida: boolean; motivo?: string } {
    if (lat === null || lng === null) return { valida: false };

    if (lat < -90 || lat > 90) {
      return { valida: false, motivo: `latitud fuera de rango (${lat}), debe estar entre -90 y 90` };
    }

    if (lng < -180 || lng > 180) {
      return {
        valida: false,
        motivo: `longitud fuera de rango (${lng}), debe estar entre -180 y 180`,
      };
    }

    return { valida: true };
  }

  /**
   * Interpreta una fecha del Excel.
   *
   * El orden importa y no es arbitrario: PRIMERO se prueba el patrón DD/MM/AAAA, porque
   * `new Date("03/04/2026")` lo interpreta como formato estadounidense (4 de marzo) en vez
   * de 3 de abril. Como eso no falla, antes se colaba silenciosamente: toda fecha con día
   * menor o igual a 12 quedaba con día y mes cambiados, y arrastraba mal la próxima revisión.
   */
  private aFecha(valor: string | undefined): Date | null {
    if (!valor) return null;

    const texto = valor.trim();

    // DD/MM/AAAA y DD-MM-AAAA, que es como se carga en Argentina.
    const latino = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (latino) {
      const dia = Number(latino[1]);
      const mes = Number(latino[2]);
      const anio = Number(latino[3]);

      if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

      const fecha = new Date(anio, mes - 1, dia);

      // Rechaza fechas que no existen (31/02): JS las desborda al mes siguiente.
      if (fecha.getDate() !== dia || fecha.getMonth() !== mes - 1) return null;

      return fecha;
    }

    // ISO (AAAA-MM-DD) y demás formatos que reconoce el motor, ya sin ambigüedad.
    const directa = new Date(texto);
    return Number.isNaN(directa.getTime()) ? null : directa;
  }

  /**
   * Centra cada zona en el promedio de sus pozos, para que el mapa encuadre bien
   * aunque el Excel no traiga una coordenada propia de la zona.
   */
  private async recalcularCentrosDeZona(zonaIds: string[]): Promise<void> {
    for (const zonaId of zonaIds) {
      const agregado = await this.prisma.pozo.aggregate({
        where: { zonaId, NOT: { lat: 0, lng: 0 } },
        _avg: { lat: true, lng: true },
      });

      if (agregado._avg.lat !== null && agregado._avg.lng !== null) {
        await this.prisma.zona.update({
          where: { id: zonaId },
          data: { lat: agregado._avg.lat, lng: agregado._avg.lng },
        });
      }
    }
  }
}
