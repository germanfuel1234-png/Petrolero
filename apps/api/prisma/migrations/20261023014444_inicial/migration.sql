-- CreateTable
CREATE TABLE "Zona" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Zona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pozo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "zonaId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pozo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valvula" (
    "id" TEXT NOT NULL,
    "pozoId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orientacion" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Valvula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoMantenimiento" (
    "id" TEXT NOT NULL,
    "valvulaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "engraseRealizado" BOOLEAN NOT NULL DEFAULT true,
    "resultadoPrueba" TEXT NOT NULL,
    "proximaRevision" TIMESTAMP(3),
    "observaciones" TEXT,
    "registradoPor" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoMantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoAccionCorrectiva" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TipoAccionCorrectiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccionCorrectiva" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "tipoAccionId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "planSemanalId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccionCorrectiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSemanal" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "semanaInicio" TIMESTAMP(3) NOT NULL,
    "notificadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zona_nombre_key" ON "Zona"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Pozo_nombre_key" ON "Pozo"("nombre");

-- CreateIndex
CREATE INDEX "Pozo_zonaId_idx" ON "Pozo"("zonaId");

-- CreateIndex
CREATE INDEX "Valvula_pozoId_idx" ON "Valvula"("pozoId");

-- CreateIndex
CREATE UNIQUE INDEX "Valvula_pozoId_codigo_key" ON "Valvula"("pozoId", "codigo");

-- CreateIndex
CREATE INDEX "EventoMantenimiento_valvulaId_fecha_idx" ON "EventoMantenimiento"("valvulaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "TipoAccionCorrectiva_nombre_key" ON "TipoAccionCorrectiva"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "AccionCorrectiva_eventoId_key" ON "AccionCorrectiva"("eventoId");

-- CreateIndex
CREATE INDEX "AccionCorrectiva_estado_idx" ON "AccionCorrectiva"("estado");

-- CreateIndex
CREATE INDEX "AccionCorrectiva_tipoAccionId_idx" ON "AccionCorrectiva"("tipoAccionId");

-- CreateIndex
CREATE INDEX "AccionCorrectiva_planSemanalId_idx" ON "AccionCorrectiva"("planSemanalId");

-- CreateIndex
CREATE INDEX "PlanSemanal_semanaInicio_idx" ON "PlanSemanal"("semanaInicio");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- AddForeignKey
ALTER TABLE "Pozo" ADD CONSTRAINT "Pozo_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "Zona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valvula" ADD CONSTRAINT "Valvula_pozoId_fkey" FOREIGN KEY ("pozoId") REFERENCES "Pozo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoMantenimiento" ADD CONSTRAINT "EventoMantenimiento_valvulaId_fkey" FOREIGN KEY ("valvulaId") REFERENCES "Valvula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccionCorrectiva" ADD CONSTRAINT "AccionCorrectiva_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoMantenimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccionCorrectiva" ADD CONSTRAINT "AccionCorrectiva_tipoAccionId_fkey" FOREIGN KEY ("tipoAccionId") REFERENCES "TipoAccionCorrectiva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccionCorrectiva" ADD CONSTRAINT "AccionCorrectiva_planSemanalId_fkey" FOREIGN KEY ("planSemanalId") REFERENCES "PlanSemanal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
