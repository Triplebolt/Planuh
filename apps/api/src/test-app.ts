import { createTestDb } from '@plannuh/db/test-db';
import { buildApp } from './app.js';

export async function createTestApp() {
  const { db, client } = await createTestDb();
  const app = buildApp(db);
  return {
    app,
    close: async () => {
      await app.close();
      await client.close();
    },
  };
}
