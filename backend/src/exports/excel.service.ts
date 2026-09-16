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
        const headers = Object.keys(s.rows[0]);
        worksheet.columns = headers.map((header) => ({
          header,
          key: header,
          width: Math.max(18, header.length + 4),
        }));

        worksheet.addRows(s.rows);

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
