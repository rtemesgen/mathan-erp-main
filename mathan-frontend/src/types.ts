export type ActorRole = 'admin' | 'supervisor' | 'accountant' | 'sales' | 'storekeeper';

export interface Permissions {
  masters: boolean;
  transactions: boolean;
  reports: boolean;
  audit: boolean;
  users: boolean;
  settings: boolean;
}

export interface Actor {
  id: string;
  businessId: string;
  uid?: string;
  name: string;
  role: ActorRole;
  pin: string;
  active: boolean;
  permissions?: Permissions;
  username?: string;
  memberships?: Membership[];
}

export interface Membership {
  businessId: string;
  businessName: string;
  role: ActorRole;
  permissions: Permissions;
}

export interface Business {
  id: string;
  name: string;
  baseCurrencyId: string;
  ownerId: string;
  baseCurrencyCode?: string;
  baseCurrency?: Currency | null;
  allowNegativeInventory?: boolean;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number; // Against USD or Global Base
  active: boolean;
}

export type AccountNature = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';

export interface ChartRangeDefinition {
  accountClass: 'ASSET' | 'INCOME' | 'EXPENSE' | 'LIABILITY' | 'EQUITY';
  fromCode: number;
  toCode: number;
  normalBalance: 'DR' | 'CR';
  description: string;
}

export interface ChartSubrangeDefinition {
  key: string;
  fromCode: number;
  toCode: number;
  description: string;
}

export interface ChartDefinition {
  ranges: ChartRangeDefinition[];
  subranges: ChartSubrangeDefinition[];
  defaults: Array<{ code: string; name: string; groupName: string; nature: string; system: boolean }>;
}

export interface AccountGroup {
  id: string;
  businessId: string;
  name: string;
  nature: AccountNature;
}

export interface Ledger {
  id: string;
  businessId: string;
  name: string;
  accountCode?: string;
  groupId: string;
  isSystem?: boolean;
  openingBalance?: number;
  openingBalanceType?: 'Dr' | 'Cr';
  active: boolean;
}

export interface Party {
  id: string;
  businessId: string;
  name: string;
  type: 'Customer' | 'Supplier' | 'Both';
  ledgerId: string;
  active: boolean;
}

export interface Unit {
  id: string;
  businessId: string;
  name: string;
  active: boolean;
}

export interface Warehouse {
  id: string;
  businessId: string;
  name: string;
  active: boolean;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  baseUnitId: string;
  sellingPrice: number;
  active: boolean;
}

export interface Period {
  id: string;
  businessId: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

export type VoucherType = 'Purchase' | 'Sale' | 'Journal' | 'PurchaseReturn' | 'SalesReturn' | 'StockAdjustment' | 'StockTransfer' | 'Payment' | 'Receipt' | 'Contra' | 'Payroll';
export type VoucherStatus = 'Posted' | 'Cancelled' | 'Reversed';

export interface Employee {
  id: string;
  businessId: string;
  name: string;
  designation: string;
  basicSalary: number;
  joinDate: string;
  active: boolean;
}

export interface CostCenter {
  id: string;
  businessId: string;
  name: string;
  active: boolean;
}

export interface BillDetail {
  billNo: string;
  amount: number;
  type: 'New Ref' | 'Against Ref' | 'Advance' | 'On Account';
  dueDate?: string;
}

export interface VoucherLine {
  ledgerId: string;
  debit: number; // Base Currency
  credit: number; // Base Currency
  txnDebit?: number; // Transaction Currency
  txnCredit?: number; // Transaction Currency
  costCenterId?: string;
  billDetails?: BillDetail[];
}

export interface StockLine {
  productId: string;
  warehouseId: string;
  unitId: string;
  quantity: number; // Positive for increase, Negative for decrease
  rate: number;
}

export interface Voucher {
  id: string;
  businessId: string;
  type: VoucherType;
  date: string;
  number: string;
  status: VoucherStatus;
  narration: string;
  actorId: string;
  currencyId: string;
  exchangeRate: number;
  lines: VoucherLine[];
  stockLines: StockLine[];
  partyId?: string; // Optional reference for commercial transactions
  createdAt: any;
  updatedAt: any;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  timestamp: any;
  actorName?: string;
  details: string;
}
