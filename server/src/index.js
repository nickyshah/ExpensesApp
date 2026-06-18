import dotenv from 'dotenv';
import { createApiApp } from './apiApp.js';
import { initDatabase } from './db/prisma.js';
import { seed } from './db/seed.js';

dotenv.config();

const PORT = process.env.PORT || 3001;

await initDatabase();
await seed();

const app = createApiApp();

app.listen(PORT, () => {
  console.log(`Expenses App API running on port ${PORT}`);
});
