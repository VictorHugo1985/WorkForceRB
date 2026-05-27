import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  typography: {
    fontSize: 13,
    fontFamily: 'var(--font-geist-sans), system-ui, -apple-system, sans-serif',
  },
  components: {
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiButton: { defaultProps: { size: 'small' } },
    MuiChip: { defaultProps: { size: 'small' } },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: '6px 12px', fontSize: 13 },
        head: { fontWeight: 600, backgroundColor: '#f8f9fa' },
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
        paper: { borderRight: '1px solid rgba(0,0,0,0.08)', boxShadow: 'none' },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          marginInline: 4,
          '&.Mui-selected': { fontWeight: 600 },
        },
      },
    },
  },
});
