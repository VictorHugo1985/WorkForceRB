'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
    </svg>
  );
}
import { AppSidebar } from '@/components/layout/AppSidebar';

const DRAWER_WIDTH = 240;

interface AppLayoutClientProps {
  children: React.ReactNode;
  nombre: string;
  roles: string[];
  exp: number;
}

export function AppLayoutClient({ children, nombre, roles, exp }: AppLayoutClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Mobile AppBar */}
      <AppBar
        position="fixed"
        sx={{ display: { md: 'none' }, zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap>
            Workforce
          </Typography>
        </Toolbar>
      </AppBar>

      <AppSidebar
        nombre={nombre}
        roles={roles}
        exp={exp}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: { md: `${DRAWER_WIDTH}px` },
          mt: { xs: '56px', md: 0 },
          p: 3,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
