const appPromise = import('../server/dist/index.js');

function normalizePath(p: string) {
  let s = String(p ?? '').trim();
  while (s.startsWith('/')) s = s.slice(1);
  if (s.toLowerCase().startsWith('api/')) s = s.slice('api/'.length);
  return s;
}

export default async function handler(req: any, res: any) {
  const mod = await appPromise;
  const app = (mod as any).default;

  const url = new URL(req.url ?? '/api', 'http://localhost');
  const pRaw = url.searchParams.get('path') ?? '';
  const p = normalizePath(pRaw);
  url.searchParams.delete('path');
  const restQuery = url.searchParams.toString();

  let next = '/api';
  if (p === 'health') next = '/api/health';
  else if (p) next = `/api/${p}`;

  if (restQuery) next += `?${restQuery}`;
  req.url = next;

  return app(req, res);
}

