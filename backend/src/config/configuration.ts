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

export default (): AppConfig => ({
  tenantId: process.env.TENANT_ID || '',
  clientId: process.env.CLIENT_ID || '',
  clientSecret: process.env.CLIENT_SECRET || '',
  powerbiScope:
    process.env.POWERBI_SCOPE ||
    'https://analysis.windows.net/powerbi/api/.default',
  pg: {
    host: process.env.PGHOST || '',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || '',
    user: process.env.PGUSER || '',
    password: process.env.PGPASSWORD || '',
  },
  port: parseInt(process.env.PORT || '3000', 10),
  syncCron: process.env.SYNC_CRON || '0 0 6 * * 3',
  corsOrigin: process.env.CORS_ORIGIN || '*',
});
