import { COLOR_ESTADO, type ValvulaConEstado } from '@petrolero/shared';
import { useState } from 'react';

interface Props {
  valvula: ValvulaConEstado;
  posicion: [number, number, number];
  seleccionada: boolean;
  onClick: () => void;
}

/**
 * Representación 3D de una válvula.
 *
 * TODO[CLIENTE]: geometría genérica (cuerpo + vástago + volante). No son modelos CAD
 * reales. Si el cliente aporta planos o archivos GLTF, se reemplaza este componente
 * cargándolos con useGLTF; la ubicación y el coloreo por estado no cambian.
 *
 * La orientación sí es real: una válvula vertical se dibuja con el eje hacia arriba y
 * una horizontal con el eje hacia el costado, tal como describió el cliente
 * ("cuatro en vertical, cinco en horizontal").
 */
export function ModeloValvula({ valvula, posicion, seleccionada, onClick }: Props): JSX.Element {
  const [hover, setHover] = useState(false);

  const color = COLOR_ESTADO[valvula.estado];
  const esVertical = valvula.orientacion === 'VERTICAL';

  // Una válvula horizontal es el mismo cuerpo rotado 90° sobre el eje Z.
  const rotacion: [number, number, number] = esVertical ? [0, 0, 0] : [0, 0, Math.PI / 2];
  const escala = seleccionada || hover ? 1.18 : 1;

  return (
    <group
      position={posicion}
      rotation={rotacion}
      scale={escala}
      onClick={(evento) => {
        evento.stopPropagation();
        onClick();
      }}
      onPointerOver={(evento) => {
        evento.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Cuerpo de la válvula */}
      <mesh castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.5, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={seleccionada ? 0.55 : 0.18}
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>

      {/* Bridas superior e inferior */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.08, 20]} />
        <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.28, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.08, 20]} />
        <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Vástago y volante: hacen reconocible la orientación de un vistazo */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.36, 10]} />
        <meshStandardMaterial color="#6b7280" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.17, 0.045, 10, 22]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Anillo de selección, sobre el plano horizontal para que no tape el cuerpo */}
      {seleccionada && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.58, 0.028, 8, 36]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  );
}
