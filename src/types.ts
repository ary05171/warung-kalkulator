export interface Product {
  id: string;
  name: string;
  price: number;
  costPrice?: number;
  category: string;
  image?: string;
  unit: string;
  stock?: number;
  favorite?: boolean;
  createdAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

export interface TransactionItem {
  productId?: string;
  name: string;
  price: number;
  costPrice?: number;
  quantity: number;
  unit: string;
  subtotal: number;
}

export interface Transaction {
  id: string;
  invoiceNumber: string;
  timestamp: string;
  items: TransactionItem[];
  totalAmount: number;
  cashGiven: number;
  change: number;
  paymentType: 'cash' | 'debt';
  customerName?: string;
  customerPhone?: string;
  debtDueDate?: string;
  debtStatus?: 'unpaid' | 'partial' | 'paid';
  debtPaidAmount?: number;
  notes?: string;
}

export interface CashEntry {
  id: string;
  type: 'in' | 'out';
  amount: number;
  category: string;
  description: string;
  supplierId?: string;
  supplierName?: string;
  timestamp: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  goodsSupplied?: string;
  notes?: string;
}

export interface DebtPayment {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface DebtItem {
  id: string;
  transactionId?: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  paidAmount: number;
  status: 'unpaid' | 'partial' | 'paid';
  createdAt: string;
  dueDate?: string;
  notes?: string;
  itemsSummary?: string;
  payments: DebtPayment[];
}

export interface WarungDatabase {
  products: Product[];
  transactions: Transaction[];
  cashEntries: CashEntry[];
  suppliers: Supplier[];
  debts: DebtItem[];
  settings: {
    storeName: string;
    storeAddress: string;
    storePhone: string;
    receiptFooter: string;
  };
}
