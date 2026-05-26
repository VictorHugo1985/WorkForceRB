'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { NAV_ITEMS } from '@/lib/nav-config';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { SessionTimer } from './SessionTimer';

export const DRAWER_WIDTH = 200;

export interface AppSidebarProps {
  nombre: string;
  roles: string[];
  exp: number;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href;
  return pathname.startsWith(href);
}

export function AppSidebar({ nombre, roles, exp }: AppSidebarProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.some((r) => roles.includes(r)),
  );

  return (
    <>
      <SessionTimer exp={exp} />
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            overflowX: 'hidden',
          },
        }}
        open
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              Workforce
            </Typography>
          </Box>

          {/* Nav items */}
          <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
            <List dense disablePadding>
              {visibleItems.map((item) => (
                <ListItemButton
                  key={item.href}
                  component={Link}
                  href={item.href}
                  selected={isActive(pathname, item.href)}
                  sx={{ py: 0.75, px: 2 }}
                >
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: { variant: 'body2', noWrap: true },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>

          {/* Footer */}
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
        </Box>
      </Drawer>
    </>
  );
}
