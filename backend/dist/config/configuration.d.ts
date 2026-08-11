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
declare const _default: () => AppConfig;
export default _default;
