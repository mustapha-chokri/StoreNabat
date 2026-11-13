import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/db/schema/control-plane.ts', './src/db/schema/tenant/index.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nabat_atlas',
  },
});

