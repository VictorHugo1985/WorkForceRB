'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { NAV_ITEMS } from '@/lib/nav-config';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { SessionTimer } from './SessionTimer';

export const DRAWER_WIDTH = 200;
export const DRAWER_COLLAPSED_WIDTH = 48;

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
  );
}

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
          },
        }}
        open
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: open ? 'space-between' : 'center',
              px: open ? 2 : 0,
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              minHeight: 48,
            }}
          >
            {open && (
              <Typography variant="body2" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
                Workforce
              </Typography>
            )}
            <Tooltip title={open ? 'Ocultar menú' : 'Mostrar menú'} placement="right">
              <IconButton size="small" onClick={onToggle}>
                {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Nav items */}
          <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
            <List dense disablePadding>
              {visibleItems.map((item) => (
                <Tooltip
                  key={item.href}
                  title={open ? '' : item.label}
                  placement="right"
                  disableHoverListener={open}
                >
                  <ListItemButton
                    component={Link}
                    href={item.href}
                    selected={isActive(pathname, item.href)}
                    sx={{
                      py: 0.75,
                      px: open ? 2 : 0,
                      justifyContent: open ? 'flex-start' : 'center',
                      minHeight: 36,
                    }}
                  >
                    {open && (
                      <ListItemText
                        primary={item.label}
                        slotProps={{
                          primary: { variant: 'body2', noWrap: true },
                        }}
                      />
                    )}
                    {!open && (
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 600, lineHeight: 1 }}
                      >
                        {item.label.slice(0, 2).toUpperCase()}
                      </Typography>
                    )}
                  </ListItemButton>
                </Tooltip>
              ))}
            </List>
          </Box>

          {/* Footer */}
          {open && (
            <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <Typography
                noWrap
                variant="caption"
                sx={{ display: 'block', fontWeight: 500, mb: 1, color: 'text.secondary' }}
              >
                {nombre}
              </Typography>
              <LogoutButton />
            </Box>
          )}
        </Box>
      </Drawer>
    </>
  );
}
