import { Voucher, StockLine } from '../types';

export const getStockLevel = (vouchers: Voucher[], productId: string, warehouseId: string): number => {
  return vouchers.reduce((total, v) => {
    if (v.status === 'Cancelled') return total;
    const lines = v.stockLines.filter(sl => sl.productId === productId && sl.warehouseId === warehouseId);
    return total + lines.reduce((sum, line) => sum + line.quantity, 0);
  }, 0);
};

export const getProductHistory = (vouchers: Voucher[], productId: string) => {
  const history: { date: string, type: string, number: string, quantity: number, rate: number, warehouseId: string }[] = [];
  
  vouchers.forEach(v => {
    if (v.status === 'Cancelled') return;
    v.stockLines.forEach(sl => {
      if (sl.productId === productId) {
        history.push({
          date: v.date,
          type: v.type,
          number: v.number,
          quantity: sl.quantity,
          rate: sl.rate,
          warehouseId: sl.warehouseId
        });
      }
    });
  });

  return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
