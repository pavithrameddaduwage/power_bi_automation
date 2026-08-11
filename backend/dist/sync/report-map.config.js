"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_MAP = void 0;
exports.findReportEntry = findReportEntry;
exports.REPORT_MAP = [];
function findReportEntry(request) {
    const r = request.trim().toLowerCase();
    return exports.REPORT_MAP.find((e) => e.request.toLowerCase() === r);
}
//# sourceMappingURL=report-map.config.js.map