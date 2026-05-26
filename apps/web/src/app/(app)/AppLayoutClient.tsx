'use client';

import Box from '@mui/material/Box';
import { AppSidebar, DRAWER_WIDTH } from '@/components/layout/AppSidebar';

interface AppLayoutClientProps {
  children: React.ReactNode;
  nombre: string;
  roles: string[];
  exp: number;
}

export function AppLayoutClient({ children, nombre, roles, exp }: AppLayoutClientProps) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppSidebar nombre={nombre} roles={roles} exp={exp} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${DRAWER_WIDTH}px`,
          p: 3,
          minWidth: 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
