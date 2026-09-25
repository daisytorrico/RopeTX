/**
 * Servicio de autenticación para la consola de control.
 */
import { BACKEND_URL } from '../config';

const ACCESS_TOKEN_KEY = 'ropetx_access_token';

class AuthService {
  public getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  public setToken(token: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }

  public clearToken(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  public isAuthenticated(): boolean {
    return Boolean(this.getAccessToken());
  }

  public async login(secret: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: false, error: data.detail || 'Invalid access key. Please try again.' };
      }

      const data = await response.json();
      if (data.access_token) {
        this.setToken(data.access_token);
        return { success: true };
      }
      return { success: false, error: 'Authentication failed.' };
    } catch {
      return { success: false, error: 'Cannot connect to backend server. Verify service is online.' };
    }
  }

  public logout(): void {
    this.clearToken();
  }

  public async authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getAccessToken();
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      this.clearToken();
    }
    return response;
  }
}

export const authService = new AuthService();
