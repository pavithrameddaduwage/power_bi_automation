import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const pg = config.get<any>('pg');
        return new Pool({
          host: pg.host,
          port: pg.port,
          database: pg.database,
          user: pg.user,
          password: pg.password,
          max: 10,
        });
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
