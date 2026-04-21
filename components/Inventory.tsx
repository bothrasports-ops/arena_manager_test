
import React, { useState } from 'react';
import {
  Package,
  Plus,
  Trash2,
  IndianRupee,
  RefreshCw,
  Loader2,
  AlertTriangle,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { DrinkInventoryItem, Booking, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface InventoryProps {
  inventory: DrinkInventoryItem[];
  bookings: Booking[];
  onUpdate: () => void;
  venueId?: string;
  userRole?: UserRole;
}

const InventoryItemRow: React.FC<{
  item: DrinkInventoryItem;
  onUpdateField: (id: string, field: string, value: string | number) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  canEdit: boolean;
}> = ({ item, onUpdateField, onRemove, canEdit }) => {
  const [localStock, setLocalStock] = useState(item.stockQuantity);
  const [localPurchasePrice, setLocalPurchasePrice] = useState(item.purchasePrice || 0);
  const [localPrice, setLocalPrice] = useState(item.price);
  const [localImageUrl, setLocalImageUrl] = useState(item.imageUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleBlur = async (field: string, value: string | number, setter: (v: any) => void, originalValue: string | number) => {
    if (value === originalValue) return;
    setIsSaving(true);
    await onUpdateField(item.id, field, value);
    setIsSaving(false);
  };

  const profitPerItem = localPrice - localPurchasePrice;
  const totalPotentialProfit = profitPerItem * localStock;

  return (
      <div className="group flex flex-col md:flex-row md:items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl hover:border-indigo-200 transition-all hover:shadow-md gap-4 relative">
        {isSaving && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-2xl">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
            </div>
        )}
        <div className="flex items-center gap-4 flex-1">
          <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 shrink-0 overflow-hidden">
            {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
                <Package className="text-indigo-600 w-6 h-6" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-900">{item.name}</p>
            {canEdit && (
                <input
                    type="text"
                    placeholder="Image URL"
                    value={localImageUrl}
                    onChange={(e) => setLocalImageUrl(e.target.value)}
                    onBlur={() => handleBlur('image_url', localImageUrl, setLocalImageUrl, item.imageUrl || '')}
                    className="w-full mt-1 px-2 py-0.5 text-[10px] bg-slate-50 border border-transparent hover:border-slate-200 rounded outline-none"
                />
            )}
            <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
              Profit/Unit: ₹{profitPerItem}
            </span>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
              Total Potential: ₹{totalPotentialProfit}
            </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 flex-1">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Stock</label>
            <input
                type="number"
                value={localStock}
                onChange={(e) => setLocalStock(Number(e.target.value))}
                onBlur={() => handleBlur('stock_quantity', localStock, setLocalStock, item.stockQuantity)}
                disabled={!canEdit}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Buy (₹)</label>
            <input
                type="number"
                value={localPurchasePrice}
                onChange={(e) => setLocalPurchasePrice(Number(e.target.value))}
                onBlur={() => handleBlur('purchase_price', localPurchasePrice, setLocalPurchasePrice, item.purchasePrice || 0)}
                disabled={!canEdit}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Sell (₹)</label>
            <input
                type="number"
                value={localPrice}
                onChange={(e) => setLocalPrice(Number(e.target.value))}
                onBlur={() => handleBlur('price', localPrice, setLocalPrice, item.price)}
                disabled={!canEdit}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center">
          {canEdit && (isConfirmingDelete ? (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-all uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                    onClick={() => onRemove(item.id)}
                    className="px-3 py-1.5 text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all uppercase tracking-wider shadow-sm"
                >
                  Confirm
                </button>
              </div>
          ) : (
              <button
                  onClick={() => setIsConfirmingDelete(true)}
                  className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  title="Delete Item"
              >
                <Trash2 className="w-5 h-5" />
              </button>
          ))}
        </div>
      </div>
  );
};

const Inventory: React.FC<InventoryProps> = ({ inventory, bookings, onUpdate, venueId, userRole }) => {
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<number | ''>(0);
  const [newItemPurchasePrice, setNewItemPurchasePrice] = useState<number | ''>(0);
  const [newItemStock, setNewItemStock] = useState<number | ''>(0);
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = userRole === UserRole.ADMIN;

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || newItemPrice === '' || Number(newItemPrice) < 0) return;
    if (!canEdit) {
      toast.error('Only admins can add items to inventory.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const { error: supabaseError } = await supabase
          .from('inventory')
          .insert({
            name: newItemName.trim(),
            price: Number(newItemPrice),
            purchase_price: Number(newItemPurchasePrice) || 0,
            stock_quantity: Number(newItemStock) || 0,
            image_url: newItemImageUrl.trim() || null,
            venue_id: venueId
          });

      if (supabaseError) throw supabaseError;
      setNewItemName('');
      setNewItemPrice(0);
      setNewItemPurchasePrice(0);
      setNewItemStock(0);
      setNewItemImageUrl('');
      onUpdate();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to add item.');
    } finally {
      setIsProcessing(false);
    }
  };

  const removeItem = async (id: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const { error: supabaseError } = await supabase
          .from('inventory')
          .delete()
          .eq('id', id);

      if (supabaseError) {
        if (supabaseError.code === '23503') {
          setError('Cannot delete this item because it is linked to existing bookings or sales. You can set its stock to 0 instead.');
        } else {
          throw supabaseError;
        }
      } else {
        onUpdate();
      }
    } catch (err: any) {
      console.error(err);
      setError(`Failed to delete item: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateItemField = async (id: string, field: string, value: string | number) => {
    if (!canEdit) {
      toast.error('Only admins can edit inventory.');
      return;
    }
    try {
      const { error } = await supabase
          .from('inventory')
          .update({ [field]: value })
          .eq('id', id);
      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update item');
    }
  };

  return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Package className="w-5 h-5" />
              Inventory Management
            </h2>
            {isProcessing && <Loader2 className="w-4 h-4 text-white/50 animate-spin" />}
          </div>

          <div className="p-6">
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div className="flex-1 text-sm font-medium">{error}</div>
                  <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
            )}
            {canEdit && (
                <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div className="md:col-span-1 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-widest">Drink Name</label>
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                          type="text"
                          placeholder="e.g. Red Bull"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm"
                          required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-widest">Buy (₹)</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                          type="number"
                          placeholder="0"
                          value={newItemPurchasePrice}
                          onChange={(e) => setNewItemPurchasePrice(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                          required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-widest">Sell (₹)</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                          type="number"
                          placeholder="0"
                          value={newItemPrice}
                          onChange={(e) => setNewItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                          required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-widest">Stock</label>
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                          type="number"
                          placeholder="0"
                          value={newItemStock}
                          onChange={(e) => setNewItemStock(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                          required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-widest">Image URL</label>
                    <input
                        type="text"
                        placeholder="https://..."
                        value={newItemImageUrl}
                        onChange={(e) => setNewItemImageUrl(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-[10px]"
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <button
                        type="submit"
                        disabled={isProcessing}
                        className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </form>
            )}

            <div className="space-y-3">
              <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider px-2 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                Current Stock & Profit Analysis
              </h3>
              {inventory.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-3xl text-slate-400 italic">
                    No items in inventory.
                  </div>
              ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {inventory.map((item) => (
                        <InventoryItemRow
                            key={item.id}
                            item={item}
                            onUpdateField={updateItemField}
                            onRemove={removeItem}
                            canEdit={canEdit}
                        />
                    ))}
                  </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-slate-400 text-xs pb-12">
          ArenaSync Enterprise &bull; Inventory Management System
        </p>
      </div>
  );
};

export default Inventory;
