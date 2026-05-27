import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export function ComingSoon({ title }: { title: string }) {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        Esta sección está en desarrollo.
      </Typography>
    </Box>
  );
}
