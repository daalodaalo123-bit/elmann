const appPromise = import('../server/dist/index.js');

export default async function handler(req: any, res: any) {
  const mod = await appPromise;
  const app = (mod as any).default;
  return app(req, res);
}

