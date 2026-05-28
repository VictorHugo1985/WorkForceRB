export interface NavItem {
  label: string;
  href: string;
  roles: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio',               href: '/dashboard',     roles: ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO', 'COLABORADOR'] },
  { label: 'Colaboradores',        href: '/colaboradores', roles: ['ADMINISTRADOR'] },
  { label: 'Configuración',        href: '/configuracion', roles: ['ADMINISTRADOR'] },
  { label: 'Semanas Laborales',    href: '/semanas-laborales', roles: ['ADMINISTRADOR', 'SUPERVISOR'] },
  { label: 'Liquidaciones',        href: '/liquidaciones', roles: ['ADMINISTRADOR', 'SUPERVISOR'] },
  { label: 'Cola de Pagos',        href: '/pagos',         roles: ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO'] },
  { label: 'Eventos Biométricos',  href: '/eventos',       roles: ['ADMINISTRADOR', 'SUPERVISOR'] },
  { label: 'Usuarios del Sistema', href: '/usuarios',      roles: ['ADMINISTRADOR'] },
];

export const ROUTE_ROLES: Record<string, string[]> = {
  '/dashboard':     ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO', 'COLABORADOR'],
  '/colaboradores': ['ADMINISTRADOR'],
  '/configuracion': ['ADMINISTRADOR'],
  '/semanas-laborales': ['ADMINISTRADOR', 'SUPERVISOR'],
  '/liquidaciones': ['ADMINISTRADOR', 'SUPERVISOR'],
  '/pagos':         ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO'],
  '/eventos':       ['ADMINISTRADOR', 'SUPERVISOR'],
  '/usuarios':      ['ADMINISTRADOR'],
};

export const PUBLIC_ROUTES = ['/login', '/auth', '/api/auth/login', '/api/webhooks'];
