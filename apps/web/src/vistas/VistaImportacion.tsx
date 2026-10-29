import { useRef, useState } from 'react';

import { api, type ReporteImportacion } from '../api';
import { BannerSupuesto } from '../componentes/BannerSupuesto';

/**
 * Importación del Excel maestro.
 * Siempre hace primero una vista previa (modo simulación, no escribe en base) y recién
 * después de confirmar ejecuta la importación real.
 */
export function VistaImportacion({ onImportado }: { onImportado: () => void }): JSX.Element {
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<ReporteImportacion | null>(null);
  const [resultado, setResultado] = useState<ReporteImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function analizar(seleccionado: File): Promise<void> {
    setArchivo(seleccionado);
    setPrevia(null);
    setResultado(null);
    setError(null);
    setOcupado(true);

    try {
      setPrevia(await api.importarExcel(seleccionado, true));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo');
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar(): Promise<void> {
    if (!archivo) return;

    setOcupado(true);
    setError(null);

    try {
      const reporte = await api.importarExcel(archivo, false);
      setResultado(reporte);
      setPrevia(null);
      onImportado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo importar el archivo');
    } finally {
      setOcupado(false);
    }
  }

  function limpiar(): void {
    setArchivo(null);
    setPrevia(null);
    setResultado(null);
    setError(null);
    if (entradaArchivo.current) entradaArchivo.current.value = '';
  }

  const reporte = resultado ?? previa;

  return (
    <div className="vista">
      <h1>Importación de datos (Excel / CSV)</h1>
      <p className="subtitulo">
        Carga masiva de pozos, válvulas e historial de mantenimiento.
      </p>

      <BannerSupuesto id="ESTRUCTURA_EXCEL" />

      {error && <div className="error">{error}</div>}

      <div
        className="tarjeta"
        style={{
          border: '2px dashed var(--borde)',
          textAlign: 'center',
          padding: 30,
          marginBottom: 18,
          cursor: 'pointer',
        }}
        onClick={() => entradaArchivo.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const soltado = e.dataTransfer.files[0];
          if (soltado) void analizar(soltado);
        }}
      >
        <input
          ref={entradaArchivo}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const elegido = e.target.files?.[0];
            if (elegido) void analizar(elegido);
          }}
        />
        <p style={{ fontSize: 13.5, marginBottom: 5 }}>
          {archivo ? archivo.name : 'Arrastrá el Excel maestro acá o hacé click para elegirlo'}
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--texto-tenue)' }}>
          Formatos: .xlsx, .xls, .csv (máx. 50 MB)
        </p>
      </div>

      {ocupado && <div className="cargando">Procesando archivo…</div>}

      {reporte && (
        <div className="tarjeta">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            <h2 style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
              {resultado ? 'Importación completada' : 'Vista previa (todavía no se guardó nada)'}
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="boton-secundario" onClick={limpiar}>
                {resultado ? 'Importar otro archivo' : 'Cancelar'}
              </button>
              {previa && !resultado && (
                <button
                  type="button"
                  className="boton"
                  onClick={confirmar}
                  disabled={ocupado || previa.filasImportadas === 0}
                >
                  Confirmar e importar
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 10,
              marginBottom: 14,
            }}
          >
            <Metrica etiqueta="Filas leídas" valor={reporte.filasLeidas} />
            <Metrica
              etiqueta={resultado ? 'Importadas' : 'Válidas'}
              valor={reporte.filasImportadas}
              color="var(--ok)"
            />
            <Metrica
              etiqueta="Con error"
              valor={reporte.errores.length}
              color={reporte.errores.length > 0 ? 'var(--falla)' : undefined}
            />
          </div>

          {resultado && (
            <p style={{ fontSize: 12, color: 'var(--texto-tenue)', marginBottom: 14 }}>
              Creados: {resultado.creados.zonas} zonas · {resultado.creados.pozos} pozos ·{' '}
              {resultado.creados.valvulas} válvulas · {resultado.creados.eventos} eventos ·{' '}
              {resultado.creados.acciones} acciones correctivas.
            </p>
          )}

          {reporte.columnasNoEncontradas.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: 11.5, color: 'var(--aviso)', marginBottom: 6 }}>
                Columnas no encontradas en el archivo
              </h3>
              <p style={{ fontSize: 11.5, color: 'var(--texto-tenue)' }}>
                {reporte.columnasNoEncontradas.join(', ')} — ajustar{' '}
                <code>apps/api/src/importador/mapeo-columnas.ts</code> si el Excel usa otros
                nombres.
              </p>
            </div>
          )}

          {reporte.advertencias.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: 11.5, color: 'var(--aviso)', marginBottom: 6 }}>
                Advertencias
              </h3>
              <ul style={{ fontSize: 11.5, color: 'var(--texto-tenue)', paddingLeft: 18 }}>
                {reporte.advertencias.slice(0, 10).map((advertencia, indice) => (
                  <li key={indice}>{advertencia}</li>
                ))}
              </ul>
            </div>
          )}

          {reporte.errores.length > 0 && (
            <div>
              <h3 style={{ fontSize: 11.5, color: 'var(--falla)', marginBottom: 6 }}>
                Filas rechazadas
              </h3>
              <div style={{ overflowX: 'auto', border: '1px solid var(--borde)', borderRadius: 4 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Fila</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.errores.slice(0, 50).map((fallo, indice) => (
                      <tr key={indice}>
                        <td style={{ fontFamily: 'var(--mono)' }}>{fallo.fila}</td>
                        <td>{fallo.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metrica({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: number;
  color?: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 10,
        background: 'var(--fondo)',
        border: '1px solid var(--borde)',
        borderRadius: 4,
      }}
    >
      <div style={{ fontSize: 10.5, color: 'var(--texto-tenue)' }}>{etiqueta}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color }}>
        {valor}
      </div>
    </div>
  );
}
