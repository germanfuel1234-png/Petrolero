-- Columna geoespacial de Pozo, fuera del schema de Prisma a propósito.
--
-- Prisma no soporta el tipo `geography` nativamente. En vez de pelear con eso, se usa
-- una columna GENERADA: PostgreSQL la deriva sola de lat/lng y nunca se escribe a mano.
-- Resultado: Prisma hace el CRUD con Float (simple y tipado) y las consultas espaciales
-- (clustering por cercanía) usan $queryRaw contra esta columna.
--
-- ST_MakePoint, ST_SetSRID y el cast a geography son IMMUTABLE, que es lo que exige
-- PostgreSQL para una columna generada STORED.
--
-- Importante: el orden de ST_MakePoint es (lng, lat), no (lat, lng).

-- La imagen postgis/postgis ya trae la extensión, pero la shadow database que Prisma crea
-- para validar migraciones arranca limpia: sin esta línea, falla con "type geography does not exist".
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "Pozo"
  ADD COLUMN "geom" geography(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography) STORED;

-- Índice espacial: sin esto el clustering hace scan completo de la tabla.
CREATE INDEX "pozo_geom_idx" ON "Pozo" USING GIST ("geom");
