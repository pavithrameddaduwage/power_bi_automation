import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExcelService {
  /**
   * Generates an Excel workbook from an array of objects.
   * Keys of the first object are used as columns.
   */
  async generateExcelBuffer(rows: Record<string, any>[], sheetName = 'Report'): Promise<Buffer> {
    return this.generateMultiSheetExcelBuffer([{ sheetName, rows }]);
  }

  /**
   * Generates a multi-sheet Excel workbook from an array of sheet configurations.
   */
  async generateMultiSheetExcelBuffer(
    sheets: { sheetName: string; rows: Record<string, any>[] }[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    for (const s of sheets) {
      const worksheet = workbook.addWorksheet(s.sheetName);

      if (s.rows && s.rows.length > 0) {
        const headerSet = new Set<string>();
        for (const row of s.rows) {
          if (row && typeof row === 'object') {
            Object.keys(row).forEach((k) => headerSet.add(k));
          }
        }
        const headers = Array.from(headerSet);
        worksheet.columns = headers.map((header) => ({
          header,
          key: header,
          width: Math.max(18, header.length + 4),
        }));

        const cleanRows = s.rows.map((row) => {
          const obj: Record<string, any> = {};
          for (const h of headers) {
            const val = row[h];
            if (val === null || val === undefined) {
              obj[h] = '';
            } else if (typeof val === 'object' && !(val instanceof Date)) {
              obj[h] = JSON.stringify(val);
            } else {
              obj[h] = val;
            }
          }
          return obj;
        });

        worksheet.addRows(cleanRows);

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E40AF' }, // Dark Blue header styling
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
