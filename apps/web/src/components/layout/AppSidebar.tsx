'use client';

import { useState } from 'react';
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

const DRAWER_WIDTH = 240;

export interface AppSidebarProps {
  nombre: string;
  roles: string[];
  exp: number;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href;
  return pathname.startsWith(href);
}

function SidebarContent({
  nombre,
  roles,
  pathname,
  onItemClick,
}: {
  nombre: string;
  roles: string[];
  pathname: string;
  onItemClick?: () => void;
}) {
  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.some((r) => roles.includes(r)),
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Workforce
        </Typography>
      </Box>

      <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
        <List disablePadding>
          {visibleItems.map((item) => (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={isActive(pathname, item.href)}
              onClick={onItemClick}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Box sx={{ mt: 'auto', p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 500, mb: 1 }}>
          {nombre}
        </Typography>
        <LogoutButton />
      </Box>
    </Box>
  );
}

export function AppSidebar({ nombre, roles, exp, mobileOpen, onMobileClose }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <SessionTimer exp={exp} />

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        <SidebarContent
          nombre={nombre}
          roles={roles}
          pathname={pathname}
          onItemClick={onMobileClose}
        />
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
        open
      >
        <SidebarContent nombre={nombre} roles={roles} pathname={pathname} />
      </Drawer>
    </>
  );
}
