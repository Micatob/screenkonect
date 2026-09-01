import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/db/src/schema.ts',
  out: './packages/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://screenkonect:screenkonect@localhost:5432/screenkonect',
  },
});