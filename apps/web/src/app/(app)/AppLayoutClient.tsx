'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import { AppSidebar, DRAWER_WIDTH, DRAWER_COLLAPSED_WIDTH } from '@/components/layout/AppSidebar';

const STORAGE_KEY = 'sidebar_open';

interface AppLayoutClientProps {
  children: React.ReactNode;
  nombre: string;
  roles: string[];
  exp: number;
}

export function AppLayoutClient({ children, nombre, roles, exp }: AppLayoutClientProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setOpen(stored === 'true');
  }, []);

  function handleToggle() {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  const sidebarWidth = open ? DRAWER_WIDTH : DRAWER_COLLAPSED_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppSidebar nombre={nombre} roles={roles} exp={exp} open={open} onToggle={handleToggle} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${sidebarWidth}px`,
          p: 3,
          minWidth: 0,
          transition: 'margin-left 0.2s ease',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
