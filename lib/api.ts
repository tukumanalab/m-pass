/**
 * Get the base path from Next.js configuration
 * This is needed for API calls when basePath is set
 */
export function getBasePath(): string {
  // In browser, use window location or environment variable
  if (typeof window !== 'undefined') {
    // First check if NEXT_PUBLIC_BASE_PATH is set
    if (process.env.NEXT_PUBLIC_BASE_PATH) {
      return process.env.NEXT_PUBLIC_BASE_PATH;
    }

    const path = window.location.pathname;
    // Check if we're under /member-debug or /member
    if (path.startsWith('/member-debug')) {
      return '/member-debug';
    }
    if (path.startsWith('/member')) {
      return '/member';
    }
  }

  // Server-side: use environment variable
  return process.env.NEXT_PUBLIC_BASE_PATH || '';
}

/**
 * Create an API URL with the correct base path
 * @param path - API path (e.g., '/api/members')
 * @returns Full API URL with base path
 */
export function apiUrl(path: string): string {
  const basePath = getBasePath();
  return `${basePath}${path}`;
}
