export interface NavChild {
  id: string;
  label: string;
  href: string;
}

export interface NavGroup {
  id: string;
  label: string;
  href?: string;
  children?: NavChild[];
}

export const WORKSPACE_NAV: NavGroup[] = [
  { id: 'overview', label: 'Overview', href: '/overview' },
  { id: 'products', label: 'Products', href: '/products' },
  { id: 'orders', label: 'Orders', href: '/orders' },
  { id: 'customers', label: 'Customers', href: '/customers' },
];

export const SETTINGS_NAV: NavGroup = {
  id: 'settings',
  label: 'Settings',
  // no href: settings is a folder, only its children are real pages
  children: [
    { id: 'settings.currencies', label: 'Currencies', href: '/settings/currencies' },
    { id: 'settings.storage', label: 'Storage', href: '/settings/storage' },
    { id: 'settings.api-keys', label: 'API Keys', href: '/settings/api-keys' },
    { id: 'settings.users', label: 'Users', href: '/settings/users' },
    { id: 'settings.permissions', label: 'Roles & Permissions', href: '/settings/permissions' },
  ],
};

export function findNavById(id: string): { group?: NavGroup; child?: NavChild } {
  if (!id) return {};
  const all: NavGroup[] = [...WORKSPACE_NAV, SETTINGS_NAV];
  for (const group of all) {
    if (group.id === id) return { group };
    if (group.children) {
      for (const child of group.children) {
        if (child.id === id) return { group, child };
      }
    }
  }
  return {};
}
