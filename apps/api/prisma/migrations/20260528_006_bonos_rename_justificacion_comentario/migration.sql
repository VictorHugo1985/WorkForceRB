-- Migration: Rename bonos.justificacion → bonos.comentario and set NOT NULL
-- Feature: 006-weekly-payroll (clarification 2026-05-27)
-- comentario is now required for ALL bonus types, not just GENERICO

-- Step 1: rename column
ALTER TABLE "bonos" RENAME COLUMN "justificacion" TO "comentario";

-- Step 2: backfill existing NULL values before adding NOT NULL constraint
UPDATE "bonos" SET "comentario" = 'Sin comentario' WHERE "comentario" IS NULL;

-- Step 3: add NOT NULL constraint
ALTER TABLE "bonos" ALTER COLUMN "comentario" SET NOT NULL;
