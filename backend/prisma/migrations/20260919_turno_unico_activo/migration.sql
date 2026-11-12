CREATE UNIQUE INDEX "turno_activo_unico"
ON "Reserva" ("canchaId", "fecha", "horaInicio")
WHERE "estado" IN (1, 2);
