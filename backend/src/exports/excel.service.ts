import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExcelService {
  /**
   * Generates an Excel workbook from an array of objects.
   * Keys of the first object are used as columns.
   */
  async generateExcelBuffer(rows: Record<string, any>[], sheetName = 'Report'): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    if (rows && rows.length > 0) {
      // Extract headers from the first row
      const headers = Object.keys(rows[0]);
      worksheet.columns = headers.map(header => ({
        header,
        key: header,
        width: 20
      }));

      // Add all rows
      worksheet.addRows(rows);
      
      // Basic styling for header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
