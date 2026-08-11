"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PowerBiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PowerBiService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const powerbi_auth_service_1 = require("../auth/powerbi-auth.service");
const API_BASE = 'https://api.powerbi.com/v1.0/myorg';
const DOWNLOAD_ROLES = ['Admin', 'Member', 'Contributor'];
let PowerBiService = PowerBiService_1 = class PowerBiService {
    constructor(auth) {
        this.auth = auth;
        this.logger = new common_1.Logger(PowerBiService_1.name);
    }
    async client() {
        const token = await this.auth.getAccessToken();
        return axios_1.default.create({
            baseURL: API_BASE,
            headers: { Authorization: `Bearer ${token}` },
        });
    }
    async listGroups() {
        const http = await this.client();
        const { data } = await http.get('/groups');
        return (data.value || []).map((g) => ({ id: g.id, name: g.name }));
    }
    async listAllDashboards() {
        const groups = await this.listGroups();
        const all = [];
        const http = await this.client();
        const CHUNK_SIZE = 10;
        for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
            const chunk = groups.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (g) => {
                try {
                    const { data } = await http.get(`/groups/${g.id}/dashboards`);
                    for (const d of data.value || []) {
                        all.push({
                            id: d.id,
                            displayName: d.displayName,
                            groupId: g.id,
                            groupName: g.name,
                        });
                    }
                }
                catch (e) {
                    this.logger.warn(`Could not read dashboards for workspace ${g.name}: ${e}`);
                }
            }));
        }
        return all;
    }
    async listGroupUsers(groupId) {
        const http = await this.client();
        const { data } = await http.get(`/groups/${groupId}/users`);
        return (data.value || []).map((u) => ({
            name: u.displayName ?? u.identifier ?? 'unknown',
            email: u.emailAddress ?? u.identifier ?? '',
            role: u.groupUserAccessRight ?? 'Unknown',
            principalType: u.principalType ?? 'User',
            canDownload: DOWNLOAD_ROLES.includes(u.groupUserAccessRight),
        }));
    }
    async reportsWithAccess() {
        const groups = await this.listGroups();
        const http = await this.client();
        const out = [];
        const CHUNK_SIZE = 10;
        for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
            const chunk = groups.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (g) => {
                let access = [];
                try {
                    access = await this.listGroupUsers(g.id);
                }
                catch (e) {
                    this.logger.warn(`Could not read users for workspace ${g.name}: ${e}`);
                }
                try {
                    const { data } = await http.get(`/groups/${g.id}/reports`);
                    for (const r of data.value || []) {
                        out.push({
                            id: r.id,
                            name: r.name,
                            reportType: r.reportType,
                            webUrl: r.webUrl,
                            datasetId: r.datasetId,
                            workspaceId: g.id,
                            workspaceName: g.name,
                            downloadable: r.reportType === 'PowerBIReport',
                            access,
                        });
                    }
                }
                catch (e) {
                    this.logger.warn(`Could not read reports for workspace ${g.name}: ${e}`);
                }
            }));
        }
        return out;
    }
    async allWorkspaceUsers() {
        const groups = await this.listGroups();
        const out = [];
        const CHUNK_SIZE = 10;
        for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
            const chunk = groups.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (g) => {
                try {
                    const users = await this.listGroupUsers(g.id);
                    for (const u of users) {
                        out.push({
                            workspace_id: g.id,
                            workspace_name: g.name,
                            display_name: u.name,
                            email: u.email,
                            role: u.role,
                            principal_type: u.principalType,
                            can_download: u.canDownload,
                        });
                    }
                }
                catch (e) {
                    this.logger.warn(`Could not read users for workspace ${g.name}: ${e}`);
                }
            }));
        }
        return out;
    }
    async findDashboardByName(name) {
        const needle = name.trim().toLowerCase();
        const dashboards = await this.listAllDashboards();
        const exact = dashboards.find((d) => d.displayName.toLowerCase() === needle);
        if (exact)
            return exact;
        const contains = dashboards.find((d) => d.displayName.toLowerCase().includes(needle));
        if (contains)
            return contains;
        const tokens = needle.split(/\s+/);
        return (dashboards.find((d) => {
            const t = d.displayName.toLowerCase();
            return tokens.every((tok) => t.includes(tok));
        }) || null);
    }
    async getDashboardTiles(groupId, dashboardId) {
        const http = await this.client();
        const { data } = await http.get(`/groups/${groupId}/dashboards/${dashboardId}/tiles`);
        return (data.value || []).map((t) => ({
            id: t.id,
            title: t.title,
            reportId: t.reportId,
            datasetId: t.datasetId,
        }));
    }
    async resolveDatasetsForDashboard(dashboard) {
        const tiles = await this.getDashboardTiles(dashboard.groupId, dashboard.id);
        const datasetIds = Array.from(new Set(tiles.map((t) => t.datasetId).filter(Boolean)));
        return datasetIds.map((datasetId) => ({
            groupId: dashboard.groupId,
            groupName: dashboard.groupName,
            dashboardId: dashboard.id,
            dashboardName: dashboard.displayName,
            datasetId,
        }));
    }
    async listDatasetTables(groupId, datasetId) {
        const http = await this.client();
        const { data } = await http.get(`/groups/${groupId}/datasets/${datasetId}/tables`);
        return (data.value || []).map((t) => t.name);
    }
    async executeQuery(groupId, datasetId, dax) {
        const http = await this.client();
        const { data } = await http.post(`/groups/${groupId}/datasets/${datasetId}/executeQueries`, {
            queries: [{ query: dax }],
            serializerSettings: { includeNulls: true },
        });
        return this.cleanRows(data?.results?.[0]?.tables?.[0]?.rows ?? []);
    }
    cleanRows(rawRows) {
        return rawRows.map((row) => {
            const clean = {};
            for (const [k, v] of Object.entries(row)) {
                const m = k.match(/\[(.+)\]$/);
                clean[m ? m[1] : k] = v;
            }
            return clean;
        });
    }
    async executeQueryByDataset(datasetId, dax) {
        const http = await this.client();
        try {
            const { data } = await http.post(`/datasets/${datasetId}/executeQueries`, {
                queries: [{ query: dax }],
                serializerSettings: { includeNulls: true },
            });
            return this.cleanRows(data?.results?.[0]?.tables?.[0]?.rows ?? []);
        }
        catch (err) {
            const errBody = err?.response?.data?.error;
            const pbiErr = errBody?.['pbi.error'];
            const detail = pbiErr?.details?.find((d) => d?.detail?.value)?.detail?.value ||
                pbiErr?.details?.[0]?.detail?.value ||
                pbiErr?.code ||
                errBody?.message ||
                err.message;
            this.logger.error(`executeQueries failed (dataset ${datasetId}): ${JSON.stringify(err?.response?.data ?? err?.message)}\nDAX: ${dax}`);
            throw new Error(`DAX failed: ${detail}`);
        }
    }
    async getDatasetColumns(datasetId) {
        const rows = await this.executeQueryByDataset(datasetId, 'EVALUATE INFO.VIEW.COLUMNS()');
        const isInternalTable = (t) => /^LocalDateTable_/.test(t) ||
            /^DateTableTemplate_/.test(t) ||
            t.startsWith('_');
        return rows
            .filter((r) => r.IsHidden !== true &&
            !String(r.Name ?? '').startsWith('RowNumber') &&
            !isInternalTable(String(r.Table ?? '')))
            .map((r) => ({
            table: String(r.Table ?? ''),
            name: String(r.Name ?? ''),
            dataType: String(r.DataType ?? 'Text'),
            isKey: r.IsKey === true || r.IsUnique === true,
        }))
            .filter((c) => c.table && c.name);
    }
    async getDatasetMeasures(datasetId) {
        const rows = await this.executeQueryByDataset(datasetId, 'EVALUATE INFO.VIEW.MEASURES()');
        return rows
            .filter((r) => r.IsHidden !== true)
            .map((r) => ({
            table: String(r.Table ?? ''),
            name: String(r.Name ?? ''),
            dataType: String(r.DataType ?? 'Number'),
        }))
            .filter((m) => m.name);
    }
    buildMeasureQuery(table, groupCols, measures, limit, filter) {
        const t = `'${table.replace(/'/g, "''")}'`;
        const args = [];
        const uniqueCols = Array.from(new Set(groupCols.filter((c) => c && c.trim() !== '')));
        for (const c of uniqueCols) {
            args.push(`${t}[${c.replace(/]/g, ']]')}]`);
        }
        if (filter?.dateColumn && (filter.dateFrom || filter.dateTo)) {
            const col = filter.dateColumn.replace(/]/g, ']]');
            const from = this.daxDate(filter.dateFrom);
            const to = this.daxDate(filter.dateTo);
            const conds = [];
            if (from)
                conds.push(`${t}[${col}] >= ${from}`);
            if (to)
                conds.push(`${t}[${col}] <= ${to}`);
            if (conds.length) {
                args.push(`FILTER(ALL(${t}[${col}]), ${conds.join(' && ')})`);
            }
        }
        const uniqueMeasures = Array.from(new Set(measures.filter((m) => m && m.trim() !== '')));
        for (const m of uniqueMeasures) {
            args.push(`"${m}", [${m.replace(/]/g, ']]')}]`);
        }
        const inner = `SUMMARIZECOLUMNS(${args.join(', ')})`;
        const cap = limit && limit > 0 ? limit : 20000;
        let orderExpr = '';
        if (uniqueMeasures.length > 0) {
            orderExpr = `[${uniqueMeasures[0].replace(/]/g, ']]')}]`;
        }
        else if (uniqueCols.length > 0) {
            orderExpr = `${t}[${uniqueCols[0].replace(/]/g, ']]')}]`;
        }
        return orderExpr
            ? `EVALUATE TOPN(${cap}, ${inner}, ${orderExpr}, DESC)`
            : `EVALUATE TOPN(${cap}, ${inner})`;
    }
    daxDate(iso) {
        if (!iso)
            return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
        return m ? `DATE(${+m[1]}, ${+m[2]}, ${+m[3]})` : null;
    }
    buildProjection(table, columns, limit, filter) {
        const t = `'${table.replace(/'/g, "''")}'`;
        let tableExpr = t;
        if (filter?.dateColumn && (filter.dateFrom || filter.dateTo)) {
            const col = filter.dateColumn.replace(/]/g, ']]');
            const from = this.daxDate(filter.dateFrom);
            const to = this.daxDate(filter.dateTo);
            const conds = [];
            if (from)
                conds.push(`${t}[${col}] >= ${from}`);
            if (to)
                conds.push(`${t}[${col}] <= ${to}`);
            if (conds.length)
                tableExpr = `FILTER(${t}, ${conds.join(' && ')})`;
        }
        const uniqueCols = Array.from(new Set(columns.filter((c) => c && c.trim() !== '')));
        const parts = uniqueCols
            .map((c) => {
            const col = c.replace(/]/g, ']]');
            return `"${c}", ${t}[${col}]`;
        })
            .join(', ');
        const inner = `SELECTCOLUMNS(${tableExpr}, ${parts})`;
        const cap = limit && limit > 0 ? limit : 50000;
        return `EVALUATE TOPN(${cap}, ${inner})`;
    }
    async getReportData(datasetId, table, columns, limit = 500, filter, measures = []) {
        const cols = Array.isArray(columns) ? columns : [];
        const meas = Array.isArray(measures) ? measures : [];
        if (!table)
            throw new Error('table is required.');
        if (cols.length === 0 && meas.length === 0) {
            throw new Error('Select at least one column or measure.');
        }
        const dax = meas.length > 0
            ? this.buildMeasureQuery(table, cols, meas, limit, filter)
            : this.buildProjection(table, cols, limit, filter);
        return this.executeQueryByDataset(datasetId, dax);
    }
    async getReportDataMulti(datasetId, tables, columns, limit = 500, filter, measures = []) {
        let tableColsMap = {};
        try {
            const datasetCols = await this.getDatasetColumns(datasetId);
            for (const item of datasetCols) {
                if (!tableColsMap[item.table]) {
                    tableColsMap[item.table] = new Set();
                }
                tableColsMap[item.table].add(item.name);
            }
        }
        catch (e) {
            tableColsMap = {};
        }
        const results = await Promise.all(tables.map(async (table) => {
            try {
                const hasMap = tableColsMap[table] && tableColsMap[table].size > 0;
                const tableCols = hasMap
                    ? columns.filter((c) => tableColsMap[table].has(c))
                    : columns;
                const uniqueTableCols = Array.from(new Set(tableCols));
                if (uniqueTableCols.length === 0 && measures.length === 0) {
                    return [];
                }
                const rows = await this.getReportData(datasetId, table, uniqueTableCols, limit, filter, measures);
                return rows.map((r) => ({ ...r, _source_table: table }));
            }
            catch (err) {
                this.logger.warn(`Multi-table fetch: skipped table "${table}": ${err}`);
                return [];
            }
        }));
        const allKeys = new Set();
        for (const rows of results) {
            for (const row of rows) {
                for (const k of Object.keys(row))
                    allKeys.add(k);
            }
        }
        const merged = [];
        for (const rows of results) {
            for (const row of rows) {
                const full = {};
                for (const k of allKeys) {
                    full[k] = row[k] ?? null;
                }
                merged.push(full);
            }
        }
        return merged;
    }
};
exports.PowerBiService = PowerBiService;
exports.PowerBiService = PowerBiService = PowerBiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [powerbi_auth_service_1.PowerBiAuthService])
], PowerBiService);
//# sourceMappingURL=powerbi.service.js.map