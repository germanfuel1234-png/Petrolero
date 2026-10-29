import { Html, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import type { ValvulaConEstado } from '@petrolero/shared';

import { ModeloValvula } from './ModeloValvula';

interface Props {
  valvulas: ValvulaConEstado[];
  valvulaSeleccionada: string | null;
  onSeleccionar: (valvulaId: string) => void;
}

const SEPARACION_VERTICAL = 0.95;
const SEPARACION_HORIZONTAL = 1.15;

/**
 * Visor 3D del árbol de producción de un pozo.
 *
 * La cantidad de válvulas es SIEMPRE la real del pozo: nada está fijado en 9.
 * Las verticales se apilan sobre el eje del pozo y las horizontales salen hacia
 * los costados, alternando lado para que el conjunto quede equilibrado.
 */
export function VisorPozo3D({
  valvulas,
  valvulaSeleccionada,
  onSeleccionar,
}: Props): JSX.Element {
  const verticales = valvulas.filter((v) => v.orientacion === 'VERTICAL');
  const horizontales = valvulas.filter((v) => v.orientacion === 'HORIZONTAL');

  // Centra el conjunto vertical alrededor del origen.
  const baseVertical = -((verticales.length - 1) * SEPARACION_VERTICAL) / 2;

  const posiciones = new Map<string, [number, number, number]>();

  verticales.forEach((valvula, indice) => {
    posiciones.set(valvula.id, [0, baseVertical + indice * SEPARACION_VERTICAL, 0]);
  });

  horizontales.forEach((valvula, indice) => {
    // Alterna derecha/izquierda y baja un escalón cada par.
    const aLaDerecha = indice % 2 === 0;
    const nivel = Math.floor(indice / 2);
    const x = aLaDerecha ? SEPARACION_HORIZONTAL : -SEPARACION_HORIZONTAL;
    const y = baseVertical + nivel * SEPARACION_VERTICAL;

    posiciones.set(valvula.id, [x, y, 0]);
  });

  // La cámara se aleja a medida que el árbol tiene más válvulas, para que siempre entre.
  const alturaArbol = Math.max(verticales.length, Math.ceil(horizontales.length / 2));
  const distanciaCamara = 4.5 + alturaArbol * 0.85;

  if (valvulas.length === 0) {
    return (
      <div className="visor3d">
        <div className="vacio">Este pozo no tiene válvulas cargadas.</div>
      </div>
    );
  }

  return (
    <div className="visor3d">
      <Canvas camera={{ position: [distanciaCamara, 1.5, distanciaCamara], fov: 45 }} shadows>
        <ambientLight intensity={0.65} />
        <directionalLight position={[6, 9, 5]} intensity={1.1} castShadow />
        <directionalLight position={[-5, 3, -4]} intensity={0.35} />

        {/* Columna central: el cuerpo del pozo sobre el que se montan las válvulas */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry
            args={[0.13, 0.13, Math.max(verticales.length, 1) * SEPARACION_VERTICAL + 1.4, 12]}
          />
          <meshStandardMaterial color="#374151" metalness={0.75} roughness={0.45} />
        </mesh>

        {/* Conexiones de las válvulas horizontales a la columna */}
        {horizontales.map((valvula) => {
          const posicion = posiciones.get(valvula.id)!;
          return (
            <mesh
              key={`conexion-${valvula.id}`}
              position={[posicion[0] / 2, posicion[1], 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.07, 0.07, Math.abs(posicion[0]), 10]} />
              <meshStandardMaterial color="#374151" metalness={0.75} roughness={0.45} />
            </mesh>
          );
        })}

        {valvulas.map((valvula) => (
          <group key={valvula.id}>
            <ModeloValvula
              valvula={valvula}
              posicion={posiciones.get(valvula.id)!}
              seleccionada={valvulaSeleccionada === valvula.id}
              onClick={() => onSeleccionar(valvula.id)}
            />
            {/* Etiqueta HTML anclada a la válvula: se lee siempre, sin importar el giro. */}
            <Html
              position={[
                posiciones.get(valvula.id)![0],
                posiciones.get(valvula.id)![1] + 0.52,
                posiciones.get(valvula.id)![2],
              ]}
              center
              distanceFactor={11}
              style={{ pointerEvents: 'none' }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#e5e7eb',
                  background: 'rgba(3,7,18,0.8)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}
              >
                {valvula.codigo}
              </span>
            </Html>
          </group>
        ))}

        <OrbitControls
          enablePan={false}
          minDistance={3}
          maxDistance={26}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>

      <div className="ayuda">
        {valvulas.length} válvulas ({verticales.length} vertical / {horizontales.length} horizontal)
        · arrastrá para girar · click en una válvula para ver su detalle
      </div>
    </div>
  );
}
