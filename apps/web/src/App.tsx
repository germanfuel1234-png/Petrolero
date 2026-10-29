import {
  KPIS_VACIOS,
  type Kpis,
  type PozoDetalle,
  type PozoResumen,
  type TipoAccionCorrectiva,
  type ZonaResumen,
} from '@petrolero/shared';
import { useCallback, useEffect, useState } from 'react';

import { api } from './api';
import { useSesion } from './autenticacion';
import { MarcaAgua } from './componentes/MarcaAgua';
import { PanelPozo } from './componentes/PanelPozo';
import { VistaAcciones } from './vistas/VistaAcciones';
import { VistaImportacion } from './vistas/VistaImportacion';
import { VistaLogin } from './vistas/VistaLogin';
import { VistaMapa } from './vistas/VistaMapa';
import { VistaPlanificador } from './vistas/VistaPlanificador';

type Pantalla = 'mapa' | 'acciones' | 'planificador' | 'importacion';

/** `permiso: null` = visible para cualquier usuario autenticado. */
const PANTALLAS: Array<{ id: Pantalla; etiqueta: string; permiso: string | null }> = [
  { id: 'mapa', etiqueta: 'Mapa y pozos', permiso: null },
  { id: 'acciones', etiqueta: 'Acciones pendientes', permiso: null },
  { id: 'planificador', etiqueta: 'Planificador semanal', permiso: 'crear:planes' },
  { id: 'importacion', etiqueta: 'Importar Excel', permiso: 'importar:datos' },
];

export function App(): JSX.Element {
  const { usuario, verificando, ingresar, salir } = useSesion();
  const [pantalla, setPantalla] = useState<Pantalla>('mapa');

  const [kpis, setKpis] = useState<Kpis>(KPIS_VACIOS);
  const [zonas, setZonas] = useState<ZonaResumen[]>([]);
  const [pozos, setPozos] = useState<PozoResumen[]>([]);
  const [tiposAccion, setTiposAccion] = useState<TipoAccionCorrectiva[]>([]);

  const [zonaSeleccionada, setZonaSeleccionada] = useState<string | null>(null);
  const [pozoAbierto, setPozoAbierto] = useState<PozoDetalle | null>(null);

  // Selección compartida entre la vista de acciones y el planificador.
  const [accionesSeleccionadas, setAccionesSeleccionadas] = useState<Set<string>>(new Set());

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    try {
      const [nuevosKpis, nuevasZonas, nuevosPozos, nuevosTipos] = await Promise.all([
        api.kpis(),
        api.zonas(),
        api.pozos(),
        api.tiposAccion(),
      ]);

      setKpis(nuevosKpis);
      setZonas(nuevasZonas);
      setPozos(nuevosPozos);
      setTiposAccion(nuevosTipos);
      setError(null);
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? `${fallo.message}. ¿Está corriendo la API en el puerto 3000?`
          : 'Error al cargar los datos',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (usuario) void cargarDatos();
  }, [usuario, cargarDatos]);

  // Si cambia de usuario y la pantalla activa requiere un permiso que ya no tiene, vuelve al mapa.
  useEffect(() => {
    if (!usuario) return;
    const permisoRequerido = PANTALLAS.find((item) => item.id === pantalla)?.permiso;
    if (permisoRequerido && !usuario.permisos.includes(permisoRequerido)) {
      setPantalla('mapa');
    }
  }, [usuario, pantalla]);

  async function abrirPozo(pozoId: string): Promise<void> {
    try {
      setPozoAbierto(await api.pozo(pozoId));
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo abrir el pozo');
    }
  }

  /** Tras registrar un mantenimiento, refresca el pozo abierto y los datos globales. */
  async function refrescarTodo(): Promise<void> {
    await cargarDatos();
    if (pozoAbierto) {
      setPozoAbierto(await api.pozo(pozoAbierto.id));
    }
  }

  const pozosDeLaZona = zonaSeleccionada
    ? pozos.filter((p) => p.zonaId === zonaSeleccionada)
    : pozos;

  if (verificando) {
    return (
      <div className="pantalla-login">
        <div className="cargando">Verificando sesión…</div>
      </div>
    );
  }

  if (!usuario) {
    return <VistaLogin onIngresar={ingresar} />;
  }

  const pantallasVisibles = PANTALLAS.filter(
    (item) => item.permiso === null || usuario.permisos.includes(item.permiso),
  );

  return (
    <div className="app">
      <header className="cabecera">
        <div className="marca">
          <span className="punto" />
          GESTIÓN DE VÁLVULAS
        </div>

        <nav className="navegacion">
          {pantallasVisibles.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPantalla(item.id)}
              aria-current={pantalla === item.id ? 'page' : undefined}
            >
              {item.etiqueta}
            </button>
          ))}
        </nav>

        <div className="sesion">
          <div className="usuario">
            <span className="nombre">{usuario.nombre}</span>
            <span className="rol">{usuario.rol}</span>
          </div>
          <button type="button" className="boton-secundario" onClick={salir}>
            Salir
          </button>
        </div>
      </header>

      <div className="kpis">
        <div className="kpi">
          <span className="etiqueta">Pozos</span>
          <span className="valor">{kpis.totalPozos}</span>
        </div>
        <div className="kpi">
          <span className="etiqueta">Válvulas OK</span>
          <span className="valor" style={{ color: 'var(--ok)' }}>
            {kpis.valvulasOk}
          </span>
        </div>
        <div className="kpi">
          <span className="etiqueta">En falla</span>
          <span className="valor" style={{ color: 'var(--falla)' }}>
            {kpis.valvulasEnFalla}
          </span>
        </div>
        <div className="kpi">
          <span className="etiqueta">Acciones pend.</span>
          <span className="valor" style={{ color: 'var(--aviso)' }}>
            {kpis.accionesPendientes}
          </span>
        </div>
        <div className="kpi">
          <span className="etiqueta">Vencen en 30d</span>
          <span className="valor" style={{ color: 'var(--aviso)' }}>
            {kpis.porVencerEn30Dias}
          </span>
        </div>
      </div>

      <div className="contenido">
        {error && pantalla === 'mapa' ? (
          <div className="vista">
            <div className="error">{error}</div>
          </div>
        ) : cargando ? (
          <div className="vista">
            <div className="cargando">Cargando datos…</div>
          </div>
        ) : (
          <>
            {pantalla === 'mapa' && (
              <VistaMapa
                zonas={zonas}
                pozos={pozosDeLaZona}
                zonaSeleccionada={zonaSeleccionada}
                onSeleccionarZona={setZonaSeleccionada}
                onAbrirPozo={abrirPozo}
              />
            )}

            {pantalla === 'acciones' && (
              <VistaAcciones
                seleccionadas={accionesSeleccionadas}
                onCambiarSeleccion={setAccionesSeleccionadas}
                onIrAPlanificador={() => setPantalla('planificador')}
              />
            )}

            {pantalla === 'planificador' && (
              <VistaPlanificador
                accionesSeleccionadas={accionesSeleccionadas}
                onPlanCreado={() => {
                  setAccionesSeleccionadas(new Set());
                  void cargarDatos();
                }}
              />
            )}

            {pantalla === 'importacion' && <VistaImportacion onImportado={cargarDatos} />}
          </>
        )}
      </div>

      {pozoAbierto && (
        <PanelPozo
          pozo={pozoAbierto}
          tiposAccion={tiposAccion}
          onCerrar={() => setPozoAbierto(null)}
          onActualizar={refrescarTodo}
        />
      )}

      <MarcaAgua />
    </div>
  );
}
