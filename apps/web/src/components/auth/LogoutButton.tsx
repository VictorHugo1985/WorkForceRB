'use client';

import axios from 'axios';
import { useRouter } from 'next/navigation';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LogoutIcon from '@mui/icons-material/Logout';

interface LogoutButtonProps {
  collapsed?: boolean;
}

export function LogoutButton({ collapsed = false }: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout', {});
    } finally {
      router.push('/login');
    }
  };

  return (
    <ListItemButton
      onClick={handleLogout}
      sx={{
        mx: 0.75,
        my: 0.25,
        borderRadius: '6px',
        minHeight: 36,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: 'rgba(255,255,255,0.8)',
        px: collapsed ? 0 : 1.5,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.10)', color: 'white' },
      }}
    >
      <ListItemIcon sx={{ color: 'inherit', minWidth: collapsed ? 'unset' : 32, justifyContent: 'center' }}>
        <LogoutIcon fontSize="small" />
      </ListItemIcon>
      {!collapsed && (
        <ListItemText
          primary="Cerrar sesión"
          slotProps={{ primary: { style: { fontSize: 13 } } }}
        />
      )}
    </ListItemButton>
  );
}
