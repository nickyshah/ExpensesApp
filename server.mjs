import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import dotenv from 'dotenv';
import { createApiApp } from './server/src/apiApp.js';
import { initDatabase } from './server/src/db/prisma.js';
import { seed } from './server/src/db/seed.js';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3001', 10);

await initDatabase();
await seed();

const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();
const apiApp = createApiApp();

nextApp.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    if (pathname?.startsWith('/api')) {
      apiApp(req, res);
      return;
    }

    handle(req, res, parsedUrl);
  }).listen(port, hostname, () => {
    console.log(`Expenses App running on http://${hostname}:${port}`);
  });
});
