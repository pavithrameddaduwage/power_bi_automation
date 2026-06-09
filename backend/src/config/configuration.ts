export interface AppConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  powerbiScope: string;
  pg: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  port: number;
  syncCron: string;
  corsOrigin: string;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export default (): AppConfig => ({
  tenantId: required('TENANT_ID'),
  clientId: required('CLIENT_ID'),
  clientSecret: required('CLIENT_SECRET'),
  powerbiScope:
    process.env.POWERBI_SCOPE ||
    'https://analysis.windows.net/powerbi/api/.default',
  pg: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'powerbi_backup',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
  },
  port: parseInt(process.env.PORT || '3000', 10),
  syncCron: process.env.SYNC_CRON || '0 0 6 * * 3',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
});
