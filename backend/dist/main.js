"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const express_1 = require("express");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    const configured = (config.get('corsOrigin') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const origin = Array.from(new Set([
        ...configured,
        'http://localhost:4200',
        'http://localhost:4301',
    ]));
    app.enableCors({ origin });
    app.use((0, express_1.json)({ limit: '25mb' }));
    const port = config.get('port');
    await app.listen(port);
    console.log(`Backend listening on http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map