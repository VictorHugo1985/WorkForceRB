'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaymentsIcon from '@mui/icons-material/Payments';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import DateRangeIcon from '@mui/icons-material/DateRange';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import { NAV_ITEMS } from '@/lib/nav-config';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { SessionTimer } from './SessionTimer';

export const DRAWER_WIDTH = 220;
export const DRAWER_COLLAPSED_WIDTH = 56;

const NAV_ICONS: Record<string, React.ReactNode> = {
  '/dashboard':     <DashboardIcon fontSize="small" />,
  '/colaboradores': <PeopleIcon fontSize="small" />,
  '/configuracion': <SettingsIcon fontSize="small" />,
  '/semanas-laborales': <DateRangeIcon fontSize="small" />,
  '/liquidaciones': <ReceiptLongIcon fontSize="small" />,
  '/pagos':         <PaymentsIcon fontSize="small" />,
  '/eventos':       <FingerprintIcon fontSize="small" />,
  '/usuarios':      <ManageAccountsIcon fontSize="small" />,
};

export interface AppSidebarProps {
  nombre: string;
  roles: string[];
  exp: number;
  open: boolean;
  onToggle: () => void;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href;
  return pathname.startsWith(href);
}

const ALPHA = {
  selected: 'rgba(255,255,255,0.18)',
  hover:    'rgba(255,255,255,0.10)',
  divider:  'rgba(255,255,255,0.12)',
};

export function AppSidebar({ nombre, roles, exp, open, onToggle }: AppSidebarProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.some((r) => roles.includes(r)),
  );

  const width = open ? DRAWER_WIDTH : DRAWER_COLLAPSED_WIDTH;

  return (
    <>
      <SessionTimer exp={exp} />
      <Drawer
        variant="permanent"
        sx={{
          width,
          flexShrink: 0,
          transition: 'width 0.2s ease',
          '& .MuiDrawer-paper': {
            width,
            boxSizing: 'border-box',
            overflowX: 'hidden',
            transition: 'width 0.2s ease',
            bgcolor: 'primary.main',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        open
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: open ? 'space-between' : 'center',
            px: open ? 2 : 0,
            minHeight: 48,
            flexShrink: 0,
          }}
        >
          {open && (
            <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: 0.5, color: 'white' }}>
              Workforce
            </Typography>
          )}
          <Tooltip title={open ? 'Ocultar menú' : 'Mostrar menú'} placement="right">
            <IconButton size="small" onClick={onToggle} sx={{ color: 'rgba(255,255,255,0.8)' }}>
              {open ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        <Divider sx={{ borderColor: ALPHA.divider }} />

        {/* Nav items */}
        <List sx={{ flex: 1, py: 0.5 }}>
          {visibleItems.map((item) => {
            const active = isActive(pathname, item.href);
            const icon = NAV_ICONS[item.href];
            return (
              <ListItem key={item.href} disablePadding sx={{ display: 'block' }}>
                <Tooltip title={open ? '' : item.label} placement="right" disableHoverListener={open}>
                  <ListItemButton
                    component={Link}
                    href={item.href}
                    selected={active}
                    sx={{
                      mx: 0.75,
                      my: 0.25,
                      borderRadius: '6px',
                      minHeight: 36,
                      justifyContent: open ? 'flex-start' : 'center',
                      color: 'white',
                      px: open ? 1.5 : 0,
                      '&.Mui-selected': {
                        bgcolor: ALPHA.selected,
                        '&:hover': { bgcolor: ALPHA.selected },
                      },
                      '&:hover': { bgcolor: ALPHA.hover },
                    }}
                  >
                    {icon && (
                      <ListItemIcon
                        sx={{
                          color: 'inherit',
                          minWidth: open ? 32 : 'unset',
                          justifyContent: 'center',
                        }}
                      >
                        {icon}
                      </ListItemIcon>
                    )}
                    {open && (
                      <ListItemText
                        primary={item.label}
                        slotProps={{ primary: { style: { fontSize: 13, fontWeight: active ? 600 : 400 } } }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>

        <Divider sx={{ borderColor: ALPHA.divider }} />

        {/* Footer */}
        <Box sx={{ py: 0.5 }}>
          {open && (
            <Box sx={{ px: 2, py: 1 }}>
              <Typography
                noWrap
                variant="caption"
                sx={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}
              >
                {nombre}
              </Typography>
            </Box>
          )}
          <ListItem disablePadding>
            <Tooltip title={open ? '' : 'Cerrar sesión'} placement="right" disableHoverListener={open}>
              <LogoutButton collapsed={!open} />
            </Tooltip>
          </ListItem>
        </Box>
      </Drawer>
    </>
  );
}
