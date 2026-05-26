'use client';

import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import Step1DatosPersonales from './steps/Step1DatosPersonales';
import Step2AreaSupervisor from './steps/Step2AreaSupervisor';
import Step3Tarifa from './steps/Step3Tarifa';
import Step4Horario from './steps/Step4Horario';
import Step5CodigoBiometrico from './steps/Step5CodigoBiometrico';
import Step6Confirmacion from './steps/Step6Confirmacion';

const STEPS = [
  'Datos personales',
  'Área y supervisor',
  'Tarifa salarial',
  'Horario laboral',
  'Código biométrico',
  'Confirmación',
];

export const WizardSchema = z.object({
  nombre: z.string().min(1, 'Requerido').max(100),
  apellido: z.string().min(1, 'Requerido').max(100),
  cedula: z.string().min(1, 'Requerido'),
  area_id: z.string().uuid('Seleccione un área'),
  supervisor_id: z.string().uuid().nullable().optional(),
  tarifa_hora: z.number().positive().nullable().optional(),
  umbral_horas_extra: z.number().positive().nullable().optional(),
  codigo_biometrico: z
    .object({ dispositivo_id: z.string().uuid(), workno: z.string().min(1) })
    .nullable()
    .optional(),
});

export type WizardFormValues = z.infer<typeof WizardSchema>;

const stepSchemas = [
  WizardSchema.pick({ nombre: true, apellido: true, cedula: true }),
  WizardSchema.pick({ area_id: true }),
  z.object({}),
  z.object({}),
  z.object({}),
  z.object({}),
];

const stepComponents = [
  Step1DatosPersonales,
  Step2AreaSupervisor,
  Step3Tarifa,
  Step4Horario,
  Step5CodigoBiometrico,
  Step6Confirmacion,
];

export default function RegistroWizard() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const methods = useForm<WizardFormValues>({
    resolver: zodResolver(WizardSchema),
    mode: 'onTouched',
    defaultValues: {
      nombre: '',
      apellido: '',
      cedula: '',
      area_id: '',
      supervisor_id: null,
      tarifa_hora: null,
      umbral_horas_extra: null,
      codigo_biometrico: null,
    },
  });

  const StepComponent = stepComponents[activeStep];

  const handleNext = async () => {
    const schema = stepSchemas[activeStep];
    const values = methods.getValues();
    const result = schema.safeParse(values);
    if (!result.success) {
      await methods.trigger();
      return;
    }
    setActiveStep((s) => s + 1);
  };

  const handleBack = () => setActiveStep((s) => s - 1);

  const handleSubmit = async (data: WizardFormValues) => {
    setSubmitting(true);
    setGlobalError(null);
    setWarnings([]);
    try {
      const res = await fetch('/api/colaboradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (res.status === 409) {
        setGlobalError(json.message ?? 'Cédula duplicada');
        setActiveStep(0);
        return;
      }
      if (!res.ok) {
        setGlobalError(json.error ?? 'Error inesperado');
        return;
      }

      if (json.warnings?.length) {
        setWarnings(json.warnings);
      } else {
        router.push(`/colaboradores/${json.colaborador.id}`);
      }
    } catch {
      setGlobalError('Error de red. Intente nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const isLastStep = activeStep === STEPS.length - 1;

  return (
    <Box sx={{ width: '100%', maxWidth: 720, mx: 'auto' }}>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {globalError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setGlobalError(null)}>
          {globalError}
        </Alert>
      )}

      {warnings.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {warnings.map((w, i) => (
            <Alert key={i} severity="warning" sx={{ mb: 1 }}>
              {w}
            </Alert>
          ))}
          <Alert severity="success" sx={{ mt: 1 }}>
            Colaborador registrado. Puedes completar la configuración pendiente desde su perfil.
          </Alert>
        </Box>
      )}

      <FormProvider {...methods}>
        <Box component="form" noValidate>
          <StepComponent />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              disabled={activeStep === 0 || submitting}
              onClick={handleBack}
              variant="outlined"
            >
              Anterior
            </Button>

            {isLastStep ? (
              <Button
                variant="contained"
                disabled={submitting}
                onClick={methods.handleSubmit(handleSubmit)}
                startIcon={submitting ? <CircularProgress size={16} /> : null}
              >
                {submitting ? 'Registrando...' : 'Confirmar registro'}
              </Button>
            ) : (
              <Button variant="contained" onClick={handleNext}>
                Siguiente
              </Button>
            )}
          </Box>
        </Box>
      </FormProvider>
    </Box>
  );
}
