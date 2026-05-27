import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1a3a5c',
      light: '#2d5986',
      dark: '#0f2238',
    },
    secondary: {
      main: '#c8a94e',
      light: '#ddc06e',
      dark: '#a08930',
    },
    background: {
      default: '#f5f6fa',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'var(--font-geist-sans), "Inter", system-ui, sans-serif',
    fontSize: 13,
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
      defaultProps: { size: 'small' },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiChip: { defaultProps: { size: 'small' } },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: '6px 12px', fontSize: 13 },
        head: { fontWeight: 600, backgroundColor: '#f5f6fa' },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        selectLabel: { fontSize: 12 },
        displayedRows: { fontSize: 12 },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { fontSize: 13 } },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { border: 'none' },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          marginInline: 6,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: { borderColor: 'rgba(0,0,0,0.1)' },
      },
    },
  },
});
