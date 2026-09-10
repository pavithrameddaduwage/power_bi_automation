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
  powerbiScope: process.env.POWERBI_SCOPE || '',
  pg: {
    host: process.env.PGHOST || '',
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    database: process.env.PGDATABASE || '',
    user: process.env.PGUSER || '',
    password: process.env.PGPASSWORD || '',
  },
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4018,
  syncCron: process.env.SYNC_CRON || '',
  corsOrigin: process.env.CORS_ORIGIN || '',
});
