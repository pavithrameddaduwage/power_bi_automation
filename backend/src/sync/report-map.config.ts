/**
 * The heart of the config. Each entry describes ONE table you want backed up.
 *
 * Flow per entry:
 *   request  -> find the dashboard by `dashboardName`
 *            -> resolve the dataset(s) behind it
 *            -> EVALUATE the `daxTable` (or run `daxQuery`)
 *            -> map source columns to Postgres columns
 *            -> upsert on (businessKeys + snapshot_date)
 *
 * Add one object per report table you care about.
 */

export type PgType = 'text' | 'numeric' | 'integer' | 'boolean' | 'timestamp' | 'date';

export interface ColumnMap {
  /** Source column name as returned by DAX (after stripping the Table[..] prefix). */
  source: string;
  /** Target Postgres column name. */
  target: string;
  type: PgType;
}

export interface ReportMapEntry {
  /** What a user asks for, e.g. "inventory amazon". Case-insensitive. */
  request: string;
  /** Dashboard display name to locate in Power BI (fuzzy match). */
  dashboardName: string;
  /** DAX table to evaluate. Ignored if `daxQuery` is set. */
  daxTable?: string;
  /** Full DAX override, e.g. a filtered EVALUATE. Optional. */
  daxQuery?: string;
  /** Target Postgres table name. */
  targetTable: string;
  /** Columns that uniquely identify a business row (NOT including snapshot_date). */
  businessKeys: string[];
  /** Column mapping. Every column you want stored must be listed. */
  columns: ColumnMap[];
}

export const REPORT_MAP: ReportMapEntry[] = [
  {
    request: 'inventory amazon',
    dashboardName: 'Inventory',
    daxTable: 'InventoryAmazon',
    targetTable: 'inventory_amazon',
    businessKeys: ['sku', 'warehouse'],
    columns: [
      { source: 'SKU', target: 'sku', type: 'text' },
      { source: 'Warehouse', target: 'warehouse', type: 'text' },
      { source: 'ProductName', target: 'product_name', type: 'text' },
      { source: 'QtyOnHand', target: 'qty_on_hand', type: 'integer' },
      { source: 'UnitCost', target: 'unit_cost', type: 'numeric' },
    ],
  },
  {
    request: 'amazon sales',
    dashboardName: 'Sales',
    daxTable: 'AmazonSales',
    targetTable: 'amazon_sales',
    // Sales refreshes weekly (Wednesday). A new snapshot_date set is inserted
    // each run; re-running the same week upserts corrections in place.
    businessKeys: ['order_id', 'sku'],
    columns: [
      { source: 'OrderId', target: 'order_id', type: 'text' },
      { source: 'SKU', target: 'sku', type: 'text' },
      { source: 'OrderDate', target: 'order_date', type: 'date' },
      { source: 'Units', target: 'units', type: 'integer' },
      { source: 'Revenue', target: 'revenue', type: 'numeric' },
    ],
  },
];

export function findReportEntry(request: string): ReportMapEntry | undefined {
  const r = request.trim().toLowerCase();
  return REPORT_MAP.find((e) => e.request.toLowerCase() === r);
}
