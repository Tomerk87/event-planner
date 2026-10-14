import { defineConfig } from 'prisma/config'

// Reads backend/.env when present; in production the variables are set by
// the environment instead.
try {
  process.loadEnvFile()
} catch {
  // No .env file: rely on the environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
})
