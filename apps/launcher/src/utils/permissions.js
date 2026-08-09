import useAuthStore from '../store/authStore';

// Internal helper - not a hook
function checkPermission(permissions, permission) {
  if (!permissions || !Array.isArray(permissions)) return false;
  if (permissions.includes('admin:*')) return true;
  if (permissions.includes(permission)) return true;
  const parts = permission.split(':');
  for (let i = parts.length - 1; i > 0; i--) {
    const wildcard = parts.slice(0, i).join(':') + ':*';
    if (permissions.includes(wildcard)) return true;
  }
  return false;
}

// Hook for single permission
export const usePermission = (permission) => {
  const user = useAuthStore((s) => s.user);
  const permissions = user?.permissions || [];
  return checkPermission(permissions, permission);
};

// Hook for any permission (no conditional hook calls)
export const useAnyPermission = (permissionsList) => {
  const user = useAuthStore((s) => s.user);
  const permissions = user?.permissions || [];
  return permissionsList.some((p) => checkPermission(permissions, p));
};

// Non-hook for routes
export const hasPermission = (permission) => {
  const state = useAuthStore.getState();
  const permissions = state.user?.permissions || [];
  return checkPermission(permissions, permission);
};

export const hasAnyPermission = (permissionsList) => {
  const state = useAuthStore.getState();
  const permissions = state.user?.permissions || [];
  return permissionsList.some((p) => checkPermission(permissions, p));
};

export const canAccessBuilder = () => {
  return hasPermission('admin:*') || hasPermission('admin:builder:access');
};
