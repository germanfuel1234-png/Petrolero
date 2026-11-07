-- Borrado lógico + nombre de pozo único por zona.
--
-- Escrita a mano a propósito: el diff automático de Prisma incluía un
-- `ALTER TABLE "Pozo" ALTER COLUMN "geom" DROP DEFAULT`, y geom es una columna GENERADA
-- (ver la migración postgis_geom_pozo). No se la toca.

-- 1) Las relaciones pasan de CASCADE a RESTRICT.
--    Antes, borrar un pozo arrastraba sus válvulas y con ellas todo el historial de
--    pruebas de hermeticidad. Como es dato de seguridad, ahora la base lo impide:
--    el retiro de un equipo se hace archivándolo, no borrándolo.
ALTER TABLE "EventoMantenimiento" DROP CONSTRAINT "EventoMantenimiento_valvulaId_fkey";
ALTER TABLE "Valvula" DROP CONSTRAINT "Valvula_pozoId_fkey";
ALTER TABLE "Pozo" DROP CONSTRAINT "Pozo_zonaId_fkey";

ALTER TABLE "Pozo"
  ADD CONSTRAINT "Pozo_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "Zona"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Valvula"
  ADD CONSTRAINT "Valvula_pozoId_fkey" FOREIGN KEY ("pozoId") REFERENCES "Pozo"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventoMantenimiento"
  ADD CONSTRAINT "EventoMantenimiento_valvulaId_fkey" FOREIGN KEY ("valvulaId") REFERENCES "Valvula"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Campos de archivado (borrado lógico).
ALTER TABLE "Pozo"
  ADD COLUMN "archivadoEn" TIMESTAMP(3),
  ADD COLUMN "archivadoPor" TEXT,
  ADD COLUMN "motivoArchivado" TEXT;

ALTER TABLE "Valvula" ADD COLUMN "archivadoEn" TIMESTAMP(3);

CREATE INDEX "Pozo_archivadoEn_idx" ON "Pozo"("archivadoEn");
CREATE INDEX "Valvula_archivadoEn_idx" ON "Valvula"("archivadoEn");

-- 3) El nombre del pozo pasa a ser único por zona, no global.
--    En la industria es habitual que dos yacimientos repitan la numeración de pozos.
DROP INDEX "Pozo_nombre_key";
CREATE UNIQUE INDEX "Pozo_zonaId_nombre_key" ON "Pozo"("zonaId", "nombre");
