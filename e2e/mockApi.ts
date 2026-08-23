import type { Page } from '@playwright/test';

export const installMockApi = async (page: Page) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const path = new URL(url, window.location.origin).pathname.replace(/^\/api/, '');
      const endpoint = ['/company/companies', '/company/salesGroupByUser', '/user/data', '/company/accessMenuByUser'].find(value => path.endsWith(value));
      if (!endpoint) return originalFetch(input, init);
      const headers = new Headers(init?.headers);
      if (!headers.get('Authorization')?.startsWith('Bearer ')) return new Response(JSON.stringify({ detail: 'missing authorization' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      const bodies: Record<string, unknown> = {
        '/company/companies': [{ legalentityid: 'CO-A', name: 'Empresa E2E A', accountingcurrency: 'USD' }, { legalentityid: 'CO-B', name: 'Empresa E2E B', accountingcurrency: 'GTQ' }],
        '/company/salesGroupByUser': [{ company: 'CO-A', groupid: 'VEN-E2E', name: 'Vendedor E2E' }],
        '/user/data': { id: 'U-E2E', name: 'Usuario E2E', language: 'es-GT', personnelnumber: 'P-E2E' },
        '/company/accessMenuByUser': [],
      };
      return new Response(JSON.stringify(bodies[endpoint]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  });
};
