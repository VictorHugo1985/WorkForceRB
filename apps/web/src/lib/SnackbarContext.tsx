'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert, { AlertColor } from '@mui/material/Alert';

interface SnackbarCtx {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
  showWarning: (msg: string) => void;
  showInfo: (msg: string) => void;
}

const SnackbarContext = createContext<SnackbarCtx | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');

  const show = useCallback((msg: string, sev: AlertColor) => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const ctx: SnackbarCtx = {
    showSuccess: (msg) => show(msg, 'success'),
    showError: (msg) => show(msg, 'error'),
    showWarning: (msg) => show(msg, 'warning'),
    showInfo: (msg) => show(msg, 'info'),
  };

  return (
    <SnackbarContext.Provider value={ctx}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={5000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setOpen(false)} severity={severity} variant="filled" sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarCtx {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider');
  return ctx;
}
