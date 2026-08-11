export declare class ExcelService {
    generateExcelBuffer(rows: Record<string, any>[], sheetName?: string): Promise<Buffer>;
}
