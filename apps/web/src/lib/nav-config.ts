export interface NavItem {
  label: string;
  href: string;
  roles: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio',               href: '/dashboard',     roles: ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO', 'COLABORADOR'] },
  { label: 'Colaboradores',        href: '/colaboradores', roles: ['ADMINISTRADOR'] },
  { label: 'Evaluaciones',         href: '/evaluaciones',  roles: ['ADMINISTRADOR', 'SUPERVISOR'] },
  { label: 'Configuración',        href: '/configuracion', roles: ['ADMINISTRADOR'] },
  { label: 'Liquidaciones',        href: '/liquidaciones', roles: ['ADMINISTRADOR', 'SUPERVISOR'] },
  { label: 'Eventos Biométricos',  href: '/eventos',       roles: ['ADMINISTRADOR', 'SUPERVISOR'] },
  { label: 'Horas trabajadas',     href: '/horas-trabajadas', roles: ['ADMINISTRADOR', 'SUPERVISOR'] },
  { label: 'Configuración Reloj',  href: '/relojes',       roles: ['ADMINISTRADOR'] },
  { label: 'Usuarios del Sistema', href: '/usuarios',      roles: ['ADMINISTRADOR'] },
  { label: 'Accesos',             href: '/accesos',       roles: ['ADMINISTRADOR'] },
];

export const ROUTE_ROLES: Record<string, string[]> = {
  '/dashboard':     ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO', 'COLABORADOR'],
  '/colaboradores': ['ADMINISTRADOR'],
  '/evaluaciones':  ['ADMINISTRADOR', 'SUPERVISOR'],
  '/configuracion': ['ADMINISTRADOR'],
  '/semanas-laborales': ['ADMINISTRADOR', 'SUPERVISOR'],
  '/liquidaciones': ['ADMINISTRADOR', 'SUPERVISOR'],
  '/pagos':         ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO'],
  '/eventos':       ['ADMINISTRADOR', 'SUPERVISOR'],
  '/horas-trabajadas': ['ADMINISTRADOR', 'SUPERVISOR'],
  '/relojes':       ['ADMINISTRADOR'],
  '/usuarios':      ['ADMINISTRADOR'],
  '/accesos':       ['ADMINISTRADOR'],
};

export const PUBLIC_ROUTES = ['/login', '/auth', '/api/auth/login', '/api/webhooks'];
