import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props<T> {
  items: T[];
  /** Alto en píxeles de cada fila. Tiene que ser constante: es lo que permite el cálculo. */
  altoItem: number;
  /** Filas de más que se dibujan arriba y abajo del área visible, para que no parpadee al scrollear. */
  margen?: number;
  children: (item: T, indice: number) => ReactNode;
  vacio?: ReactNode;
  /** Clase del contenedor scrolleable, para que el layout decida su altura. */
  className?: string;
}

/**
 * Lista virtualizada: dibuja solo las filas visibles.
 *
 * Con cientos o miles de pozos, renderizar un nodo por cada uno vuelve lenta la pantalla
 * (en pruebas de carga, 540 pozos generaban 540 botones en el DOM). Acá el contenedor
 * reserva la altura total con un espaciador y solo se montan las filas dentro del
 * viewport más un margen.
 *
 * Es deliberadamente simple y asume alto fijo por fila. Si en el futuro las filas
 * pasan a tener alturas distintas, conviene reemplazarlo por una librería de
 * virtualización con medición dinámica.
 */
export function ListaVirtual<T>({
  items,
  altoItem,
  margen = 5,
  children,
  vacio,
  className,
}: Props<T>): JSX.Element {
  const contenedor = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [alto, setAlto] = useState(0);

  // El alto disponible se mide del contenedor real: depende del layout, no es fijo.
  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento) return;

    const medir = (): void => setAlto(elemento.clientHeight);
    medir();

    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  if (items.length === 0) {
    return (
      <div ref={contenedor} className={className}>
        {vacio}
      </div>
    );
  }

  const visibles = Math.ceil((alto || 1) / altoItem);
  const desde = Math.max(0, Math.floor(scroll / altoItem) - margen);
  const hasta = Math.min(items.length, desde + visibles + margen * 2);

  const porDibujar = items.slice(desde, hasta);

  return (
    <div
      ref={contenedor}
      className={className}
      onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
    >
      {/* Espaciador: mantiene la barra de scroll proporcional al total real de filas. */}
      <div style={{ height: items.length * altoItem, position: 'relative' }}>
        <div style={{ position: 'absolute', top: desde * altoItem, left: 0, right: 0 }}>
          {porDibujar.map((item, i) => (
            <div key={desde + i} style={{ height: altoItem }}>
              {children(item, desde + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
