import React, { useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Trash2,
  IndianRupee,
  Package,
  CheckCircle2,
  Loader2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { DrinkInventoryItem, PosSale, PosSaleItem } from '../types';
import { supabase } from '../lib/supabase';

interface DrinkSalesProps {
  inventory: DrinkInventoryItem[];
  sales: PosSale[];
  onSave: () => void;
  venueId?: string;
}

const DrinkSales: React.FC<DrinkSalesProps> = ({ inventory, sales, onSave, venueId }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});
  const [showHistory, setShowHistory] = useState(false);

  const totalAmount = Object.entries(selectedItems).reduce((sum, [id, qty]) => {
    const item = inventory.find(i => i.id === id);
    return sum + (item?.price || 0) * qty;
  }, 0);

  const updateQuantity = (id: string, delta: number) => {
    setSelectedItems(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const handleSubmit = async () => {
    if (Object.keys(selectedItems).length === 0) return;

    setIsSubmitting(true);
    try {
      // 1. Create POS Sale
      const { data: sale, error: saleError } = await supabase
          .from('pos_sales')
          .insert({
            venue_id: venueId,
            total_amount: totalAmount
          })
          .select()
          .single();

      if (saleError) throw saleError;

      // 2. Create Sale Items
      const saleItems = Object.entries(selectedItems).map(([id, qty]) => ({
        sale_id: sale.id,
        drink_id: id,
        quantity: qty,
        price_at_time: inventory.find(i => i.id === id)?.price || 0
      }));

      const { error: itemsError } = await supabase
          .from('pos_sale_items')
          .insert(saleItems);

      if (itemsError) throw itemsError;

      // 3. Update Inventory Stock
      for (const [id, qty] of Object.entries(selectedItems)) {
        const item = inventory.find(i => i.id === id);
        if (item) {
          await supabase
              .from('inventory')
              .update({ stock_quantity: (item.stockQuantity || 0) - qty })
              .eq('id', id);
        }
      }

      setSelectedItems({});
      onSave();
      toast.success('Sale recorded successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to record sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-600" />
            Direct Drink Sales
          </h2>
          <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-xl transition-all"
          >
            {showHistory ? 'Back to Sales' : 'View Sale History'}
          </button>
        </div>

        {!showHistory ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Inventory Selection */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {inventory.map(item => (
                      <div
                          key={item.id}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                              selectedItems[item.id]
                                  ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500'
                                  : 'border-slate-200 bg-white hover:border-indigo-200'
                          }`}
                          onClick={() => updateQuantity(item.id, 1)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm shrink-0 overflow-hidden">
                            {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                                <Package className="w-5 h-5 text-indigo-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{item.name}</p>
                            <p className="text-xs font-bold text-slate-500">₹{item.price}</p>
                          </div>
                        </div>

                        {selectedItems[item.id] ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <button
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                              >
                                -
                              </button>
                              <span className="w-8 text-center font-bold text-indigo-600">{selectedItems[item.id]}</span>
                              <button
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                              >
                                +
                              </button>
                            </div>
                        ) : (
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                              Stock: {item.stockQuantity || 0}
                            </div>
                        )}
                      </div>
                  ))}
                </div>
              </div>

              {/* Cart Summary */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm h-fit sticky top-24 overflow-hidden">
                <div className="bg-slate-900 px-6 py-4">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4" />
                    Current Order
                  </h3>
                </div>

                <div className="p-6 space-y-4">
                  {Object.keys(selectedItems).length === 0 ? (
                      <div className="py-8 text-center text-slate-400 italic text-sm">
                        Select items to start an order
                      </div>
                  ) : (
                      <>
                        <div className="space-y-3">
                          {Object.entries(selectedItems).map(([id, qty]) => {
                            const item = inventory.find(i => i.id === id);
                            return (
                                <div key={id} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-indigo-600">{qty}x</span>
                                    <span className="font-medium text-slate-700">{item?.name}</span>
                                  </div>
                                  <span className="font-bold text-slate-900">₹{(item?.price || 0) * qty}</span>
                                </div>
                            );
                          })}
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-6">
                            <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Total Amount</span>
                            <span className="text-2xl font-black text-slate-900">₹{totalAmount}</span>
                          </div>

                          <button
                              onClick={handleSubmit}
                              disabled={isSubmitting}
                              className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
                          >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                  <CheckCircle2 className="w-5 h-5" />
                                  Complete Sale
                                </>
                            )}
                          </button>
                        </div>
                      </>
                  )}
                </div>
              </div>
            </div>
        ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date & Time</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Items</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Total Amount</th>
                  </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                  {sales.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">No sales recorded yet</td>
                      </tr>
                  ) : (
                      sales.map(sale => (
                          <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-900">{new Date(sale.createdAt).toLocaleDateString()}</p>
                              <p className="text-xs text-slate-500">{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {sale.items.map((item, idx) => {
                                  const drink = inventory.find(i => i.id === item.drinkId);
                                  return (
                                      <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                                {item.quantity}x {drink?.name || 'Unknown'}
                              </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-black text-slate-900">₹{sale.totalAmount}</span>
                            </td>
                          </tr>
                      ))
                  )}
                  </tbody>
                </table>
              </div>
            </div>
        )}
      </div>
  );
};

export default DrinkSales;
