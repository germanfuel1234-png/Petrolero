/**
 * SEED DE DATOS SINTÉTICOS
 * ========================
 *
 * TODO[SUPUESTO]: todos los pozos, válvulas e historiales de este archivo son INVENTADOS.
 * Sirven para que la aplicación funcione y se pueda demostrar sin esperar el Excel del cliente.
 * Cuando llegue el archivo real, se corre el importador y estos datos se reemplazan.
 *
 * Lo único real acá son las coordenadas base de las cuencas petroleras argentinas: los pozos
 * se dispersan alrededor de esos centros para que el mapa y el agrupamiento por cercanía
 * se comporten de forma realista.
 */

import { PrismaClient } from '@prisma/client';
import { calcularProximaRevision } from '@petrolero/shared';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Generador pseudoaleatorio con semilla fija: el seed da siempre el mismo resultado. */
function crearRandom(semilla: number): () => number {
  let estado = semilla;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

const random = crearRandom(42);

function entre(min: number, max: number): number {
  return min + random() * (max - min);
}

function elegir<T>(opciones: T[]): T {
  return opciones[Math.floor(random() * opciones.length)];
}

/** Centros reales de cuencas productivas argentinas. */
const CUENCAS = [
  { nombre: 'Vaca Muerta - Loma Campana', lat: -38.41, lng: -68.91, prefijo: 'LC', pozos: 14 },
  { nombre: 'Golfo San Jorge - Zona Norte', lat: -45.86, lng: -67.48, prefijo: 'GSJ', pozos: 12 },
  { nombre: 'Cuenca Austral - Pali Aike', lat: -52.31, lng: -69.34, prefijo: 'PA', pozos: 8 },
  { nombre: 'Cuenca Cuyana - Barrancas', lat: -33.15, lng: -68.82, prefijo: 'BAR', pozos: 6 },
];

/**
 * TODO[CLIENTE]: catálogo de acciones correctivas incompleto. En los audios se mencionó
 * "lavado", "ir con una bomba" y "varias cosas más". Falta el listado completo.
 */
const ACCIONES_CORRECTIVAS = [
  { nombre: 'Lavado', descripcion: 'Lavado de la válvula para recuperar el sello.' },
  { nombre: 'Bombeo de grasa', descripcion: 'Inyección de grasa a presión con bomba.' },
  { nombre: 'Cambio de sello', descripcion: 'Reemplazo de sello o empaquetadura.' },
];

/**
 * Plantilla de válvulas de un árbol de producción.
 * Del audio: "tienen nueve válvulas, cuatro en vertical, cinco en horizontal".
 * La cantidad real varía por pozo: abajo se recorta esta lista para que no todos tengan 9.
 */
const PLANTILLA_VALVULAS = [
  { codigo: 'V-1', nombre: 'Master superior', orientacion: 'VERTICAL' },
  { codigo: 'V-2', nombre: 'Master inferior', orientacion: 'VERTICAL' },
  { codigo: 'V-3', nombre: 'Swab', orientacion: 'VERTICAL' },
  { codigo: 'V-4', nombre: 'Corona', orientacion: 'VERTICAL' },
  { codigo: 'V-5', nombre: 'Wing de producción', orientacion: 'HORIZONTAL' },
  { codigo: 'V-6', nombre: 'Wing de inyección', orientacion: 'HORIZONTAL' },
  { codigo: 'V-7', nombre: 'Choke manual', orientacion: 'HORIZONTAL' },
  { codigo: 'V-8', nombre: 'Kill line', orientacion: 'HORIZONTAL' },
  { codigo: 'V-9', nombre: 'Lateral de prueba', orientacion: 'HORIZONTAL' },
];

function restarDias(fecha: Date, dias: number): Date {
  const resultado = new Date(fecha.getTime());
  resultado.setDate(resultado.getDate() - dias);
  return resultado;
}

async function limpiar(): Promise<void> {
  // El orden importa: se borra de la hoja hacia la raíz.
  await prisma.accionCorrectiva.deleteMany();
  await prisma.eventoMantenimiento.deleteMany();
  await prisma.planSemanal.deleteMany();
  await prisma.valvula.deleteMany();
  await prisma.pozo.deleteMany();
  await prisma.zona.deleteMany();
  await prisma.tipoAccionCorrectiva.deleteMany();
  await prisma.usuario.deleteMany();
}

async function main(): Promise<void> {
  console.log('Limpiando datos anteriores...');
  await limpiar();

  // --- Usuarios ---
  // TODO[CLIENTE]: usuarios de prueba con contraseña conocida. Hay que reemplazarlos por los
  // reales y definir si el alta la hace un administrador o se integra con el login de la empresa.
  const passwordHash = await bcrypt.hash('petrolero123', 10);
  await prisma.usuario.createMany({
    data: [
      {
        email: 'supervisor@petrolero.test',
        nombre: 'Supervisor de Campo',
        passwordHash,
        rol: 'SUPERVISOR',
      },
      {
        email: 'tecnico@petrolero.test',
        nombre: 'Técnico de Mantenimiento',
        passwordHash,
        rol: 'TECNICO',
      },
    ],
  });
  console.log('2 usuarios creados (contraseña: petrolero123)');

  // --- Catálogo de acciones ---
  const tiposAccion = [];
  for (const accion of ACCIONES_CORRECTIVAS) {
    tiposAccion.push(await prisma.tipoAccionCorrectiva.create({ data: accion }));
  }
  console.log(`${tiposAccion.length} tipos de acción correctiva creados`);

  const hoy = new Date();
  let totalPozos = 0;
  let totalValvulas = 0;
  let totalEventos = 0;
  let totalAcciones = 0;

  for (const cuenca of CUENCAS) {
    const zona = await prisma.zona.create({
      data: { nombre: cuenca.nombre, lat: cuenca.lat, lng: cuenca.lng },
    });

    for (let i = 1; i <= cuenca.pozos; i++) {
      // Dispersión de ±0.25° (~25 km) alrededor del centro de la cuenca, para que el
      // clustering por cercanía tenga grupos reconocibles en vez de puntos equidistantes.
      const pozo = await prisma.pozo.create({
        data: {
          nombre: `${cuenca.prefijo}-${String(1000 + i * 7).padStart(4, '0')}`,
          zonaId: zona.id,
          lat: cuenca.lat + entre(-0.25, 0.25),
          lng: cuenca.lng + entre(-0.25, 0.25),
        },
      });
      totalPozos++;

      // Cantidad variable de válvulas por pozo (entre 3 y 9): el requisito explícito del
      // cliente es que el sistema no asuma un número fijo.
      const cantidadValvulas = Math.floor(entre(3, 10));
      const valvulasDelPozo = PLANTILLA_VALVULAS.slice(0, cantidadValvulas);

      let ordenVertical = 0;
      let ordenHorizontal = 0;

      for (const plantilla of valvulasDelPozo) {
        const orden =
          plantilla.orientacion === 'VERTICAL' ? ordenVertical++ : ordenHorizontal++;

        const valvula = await prisma.valvula.create({
          data: {
            pozoId: pozo.id,
            codigo: plantilla.codigo,
            nombre: plantilla.nombre,
            orientacion: plantilla.orientacion,
            orden,
          },
        });
        totalValvulas++;

        // Historial: 1 a 3 inspecciones pasadas por válvula.
        const cantidadEventos = Math.floor(entre(1, 4));

        // Antigüedad del último mantenimiento: define el estado actual de la válvula.
        // El rango está elegido a propósito para que la demo muestre los tres colores.
        // Con la regla de +1 año, una inspección de hace N días deja la próxima revisión
        // a (365 - N) días: hasta ~335 días da OK (verde), y de 335 a 365 cae dentro de
        // la ventana de aviso de 30 días y da POR_VENCER (amarillo).
        const diasUltimoEvento = Math.floor(entre(20, 365));

        for (let e = cantidadEventos; e >= 1; e--) {
          // Los eventos más viejos primero; el último define el estado actual.
          // Cada inspección previa va un año más atrás.
          const diasAtras = diasUltimoEvento + (e - 1) * 365;
          const fecha = restarDias(hoy, diasAtras);

          const esUltimo = e === 1;

          // ~20% de las válvulas quedan en falla, para que la demo tenga casos de los tres
          // estados (operativa, próxima a vencer, en falla).
          const resultado: 'OK' | 'NEGATIVO' =
            esUltimo && random() < 0.2 ? 'NEGATIVO' : 'OK';

          const evento = await prisma.eventoMantenimiento.create({
            data: {
              valvulaId: valvula.id,
              fecha,
              engraseRealizado: true,
              resultadoPrueba: resultado,
              proximaRevision: calcularProximaRevision(fecha, resultado),
              registradoPor: 'seed',
            },
          });
          totalEventos++;

          // Un resultado negativo siempre arrastra una acción correctiva pendiente.
          if (resultado === 'NEGATIVO') {
            await prisma.accionCorrectiva.create({
              data: {
                eventoId: evento.id,
                tipoAccionId: elegir(tiposAccion).id,
                estado: 'PENDIENTE',
              },
            });
            totalAcciones++;
          }
        }
      }
    }
  }

  console.log(`${CUENCAS.length} zonas creadas`);
  console.log(`${totalPozos} pozos creados`);
  console.log(`${totalValvulas} válvulas creadas`);
  console.log(`${totalEventos} eventos de mantenimiento creados`);
  console.log(`${totalAcciones} acciones correctivas pendientes`);
  console.log('');
  console.log('Recordatorio: estos datos son sintéticos (ver PENDIENTES-CLIENTE.md).');
}

main()
  .catch((error) => {
    console.error('Error al sembrar la base:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
