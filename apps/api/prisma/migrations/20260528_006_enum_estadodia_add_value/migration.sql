-- Migration: Add CON_AJUSTE_Y_DESCUENTO to EstadoDia enum
-- Feature: 006-weekly-payroll (clarification 2026-05-27)
-- Represents days that have both horas_ajustadas_supervisor and descuento_tipo set simultaneously

ALTER TYPE "EstadoDia" ADD VALUE 'CON_AJUSTE_Y_DESCUENTO';

-- Also add MULTIPLICADOR_HORA_EXTRA to TipoConfiguracion enum
-- Replaces TARIFA_HORA_EXTRA conceptually: overtime = tarifa_efectiva_dia × multiplicador (default 1.5)
ALTER TYPE "TipoConfiguracion" ADD VALUE 'MULTIPLICADOR_HORA_EXTRA';
