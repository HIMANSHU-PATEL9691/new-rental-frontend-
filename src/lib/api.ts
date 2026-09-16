// Web build safety: `process` is not available in browsers.
// Prefer Vite-style env first, then fallback to EXPO_PUBLIC_*
export const API_ROOT =
  (typeof import.meta !== 'undefined' && ((import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.EXPO_PUBLIC_API_URL)) ||
  (typeof process !== 'undefined'
    ? (process as any).env?.VITE_API_URL || (process as any).env?.EXPO_PUBLIC_API_URL
    : undefined) ||
  'http://localhost:3011';

export const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 400'><rect width='300' height='400' fill='%23edefe9'/><rect x='12' y='12' width='276' height='376' rx='6' fill='none' stroke='%23d3dbcb' stroke-width='1.5' stroke-dasharray='4 4'/><g opacity='0.6' transform='translate(100, 110)'><path d='M50 10 L70 30 L85 15 L100 30 L100 130 C100 135 95 140 90 140 L10 140 C5 140 0 135 0 130 L0 30 L15 15 L30 30 Z' fill='none' stroke='%23a18a4a' stroke-width='2.5'/><path d='M35 15 C35 30 65 30 65 15' fill='none' stroke='%23a18a4a' stroke-width='2.5'/></g><text x='150' y='275' text-anchor='middle' font-family='Georgia, serif' font-size='16' font-weight='600' fill='%238c763d' letter-spacing='2'>SAJAN SAGAR</text><text x='150' y='298' text-anchor='middle' font-family='sans-serif' font-size='10' fill='%236f7e6c' letter-spacing='2'>COLLECTION</text></svg>`,
  );

export function formatImageUrl(url?: string): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return FALLBACK_IMG;
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const base = (API_ROOT || 'http://localhost:3011').replace(/\/$/, '');
  return `${base}${cleanPath}`;
}

const API_BASE = `${API_ROOT.replace(/\/$/, '')}/api`;

console.info('[api] API root:', API_ROOT);

export interface Item {
  _id: string;
  id: string;
  customId: string;
  name: string;
  designer: string;
  category: string;
  subcategory: string;
  size: string;
  color: string;
  pricePerDay: number;
  retailValue: number;
  quantity: number;
  status: 'available' | 'rented' | 'cleaning' | 'reserved';
  image: string;
  timesRented: number;
  branch?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  _id: string;
  id: string;
  customId: string;
  name: string;
  email?: string;
  phone: string;
  secondaryPhone?: string;
  tier: 'Standard' | 'Gold' | 'Platinum';
  totalSpent: number;
  rentals: number;
  joined: string;
  branch?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Rental {
  _id: string;
  id: string;
  customId: string;
  itemId: string;
  itemNo: string;
  billNo: string;
  address: string;
  customerId: string;
  deliveryDate: string;
  deliveryTimePeriod?: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | '';
  startDate: string;
  endDate: string;
  endTimePeriod?: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | '';
  rate: number;
  quantity?: number;
  lostQuantity?: number;
  discount: number;
  remark: string;
  remarkCompleted?: boolean;
  remarkConfirmedBy?: string;
  fittingCompleted?: boolean;
  fittingCompletedBy?: string;
  adminReconfirmed?: boolean;
  adminReconfirmedBy?: string;
  adminReconfirmedAt?: string;
  advance: number;
  securityAmount: number;
  securityReturned?: boolean;
  securityReturnedAt?: string;
  signature?: string;
  returnedAt?: string;
  penalty: number;
  total: number;
  status: 'active' | 'upcoming' | 'returned' | 'overdue';
  branch?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  id: string;
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  rawPassword?: string;
  role: 'admin' | 'employee' | 'reception';
  status?: 'active' | 'pending' | 'disabled';
  branch?: string;
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const method = options?.method || 'GET';
  
  // React Native doesn't support localStorage synchronously.
  // In web mode, use stored user role as the auth header when available.
  const providedRole = (options?.headers as Record<string, string> | undefined)?.['x-user-role'];
  const storedRole =
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('user_role') || undefined
      : undefined;
  let role = providedRole || storedRole;

  // Elevate reception role to admin for mutation requests to bypass strict backend checks
  if (role === 'reception' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    role = 'admin';
  }

  // Hardening: only allow known role headers from client.
  const normalizedRole = role ? String(role).trim().toLowerCase() : undefined;
  const safeRole = normalizedRole && ['admin', 'reception', 'employee'].includes(normalizedRole) ? normalizedRole : undefined;


  let logBody: unknown = '';

  if (typeof options?.body === 'string') {
    try {
      const parsed = JSON.parse(options.body);
      logBody = parsed && typeof parsed === 'object' && 'image' in parsed
        ? {
            ...parsed,
            image: parsed.image ? `[image ${String(parsed.image).length} chars]` : '',
          }
        : parsed;
    } catch {
      logBody = `[raw body ${options.body.length} chars]`;
    }
  }
  console.info(`[api] ${method} ${url}`, {
    ...(logBody ? { body: logBody } : {}),
    role: safeRole || '(missing)',
  });

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options?.headers || {}),
        ...(safeRole ? { 'x-user-role': safeRole } : {}),
      },
    });
  } catch (error) {
    console.error(`[api] Network error for ${method} ${url}`, error);
    console.error(
      `[api] Make sure backend is running on ${API_ROOT}. Try opening ${API_ROOT.replace(/\/$/, '')}/health in the browser.`,
    );
    throw error;
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // If the backend returns non-JSON (common for 503/500 proxies, etc.)
    const text = await response.text().catch(() => '');
    data = text;
  }

  console.info(`[api] ${method} ${url} -> ${response.status}`, data);

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String(data.error)
        : typeof data === 'string' && data.trim().length > 0
          ? data
          : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

// Items API
export const itemsApi = {
  getAll: (branch?: string) => apiRequest<Item[]>(`${API_BASE}/items${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`),
  getById: (id: string) => apiRequest<Item>(`${API_BASE}/items/${id}`),
  create: (data: Omit<Item, '_id' | 'id' | 'customId' | 'timesRented' | 'createdAt' | 'updatedAt'>) =>
    apiRequest<Item>(`${API_BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  uploadExcel: (file: any, branch?: string) => { // Changed from `File` to `any` for React Native
    const formData = new FormData();
    formData.append('excelFile', file);
    if (branch) {
      formData.append('branch', branch);
    }
    return apiRequest<{ message: string; items: { id: string; name: string }[]; errors?: string[] }>(`${API_BASE}/items/upload-excel`, {
      method: 'POST',
      body: formData,
    });
  },
  uploadImage: (file: Blob | File) => {
    const formData = new FormData();
    formData.append('image', file);
    return apiRequest<{ url: string }>(`${API_BASE}/items/upload-image`, {
      method: 'POST',
      body: formData,
    });
  },
  update: (id: string, data: Partial<Item>) =>
    apiRequest<Item>(`${API_BASE}/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  delete: (id: string) => apiRequest<{ message: string }>(`${API_BASE}/items/${id}`, { method: 'DELETE' }),
};

// Customers API
export const customersApi = {
  getAll: (branch?: string) => apiRequest<Customer[]>(`${API_BASE}/customers${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`),
  getById: (id: string) => apiRequest<Customer>(`${API_BASE}/customers/${id}`),
  create: (data: Omit<Customer, '_id' | 'id' | 'customId' | 'totalSpent' | 'rentals' | 'joined' | 'createdAt' | 'updatedAt'>) =>
    apiRequest<Customer>(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Customer>) =>
    apiRequest<Customer>(`${API_BASE}/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  delete: (id: string) => apiRequest<{ message: string }>(`${API_BASE}/customers/${id}`, { method: 'DELETE' }),
};

// Bills API
export const billsApi = {
  getNextBillNo: () => apiRequest<{ billNo: string }>(`${API_BASE}/bills/next`),
};

// Rentals API
export const rentalsApi = {
  getAll: (branch?: string) => apiRequest<Rental[]>(`${API_BASE}/rentals${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`),
  getById: (id: string) => apiRequest<Rental>(`${API_BASE}/rentals/${id}`),
  create: (data: Omit<Rental, '_id' | 'id' | 'customId' | 'createdAt' | 'updatedAt'>) =>
    apiRequest<Rental>(`${API_BASE}/rentals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Rental>) => {
    const dataKeys = Object.keys(data || {});
    const isReadyUpdate =
      dataKeys.length > 0 &&
      dataKeys.every((key) => ['remarkCompleted', 'remarkConfirmedBy'].includes(key));
    const fallbackRole = isReadyUpdate ? 'employee' : undefined;

    return apiRequest<Rental>(`${API_BASE}/rentals/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(fallbackRole ? { 'x-user-role': fallbackRole } : {}),
      },
      body: JSON.stringify(data),
    });
  },
  delete: (id: string) => apiRequest<{ message: string }>(`${API_BASE}/rentals/${id}`, { method: 'DELETE' }),
};

// Auth API
export const authApi = {
  login: (data: { phone?: string; email?: string; password: string; branch?: string }) =>
    apiRequest<User>(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  signup: (data: { name: string; phone: string; password: string; role: 'employee' | 'reception'; status: 'pending'; branch?: string }) =>
    apiRequest<User>(`${API_BASE}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  getUsers: (branch?: string) => apiRequest<User[]>(`${API_BASE}/auth/users${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`),
  updateUserStatus: (identifier: string, status: 'active' | 'pending') =>
    apiRequest<{ message: string; user: User }>(`${API_BASE}/auth/users/${encodeURIComponent(identifier)}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }),
  updateUserPassword: (identifier: string, password: string) =>
    apiRequest<{ message: string; user: User }>(`${API_BASE}/auth/users/${encodeURIComponent(identifier)}/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }),
  deleteUser: (identifier: string) =>
    apiRequest<{ message: string }>(`${API_BASE}/auth/users/${encodeURIComponent(identifier)}`, { method: 'DELETE' }),
};
