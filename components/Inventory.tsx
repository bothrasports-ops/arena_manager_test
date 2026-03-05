
import React, { useState } from 'react';
import {
  Package,
  Plus,
  Trash2,
  IndianRupee,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { DrinkInventoryItem, Booking } from '../types';
import { supabase } from '../lib/supabase';

interface InventoryProps {
  inventory: DrinkInventoryItem[];
  bookings: Booking[];
  onUpdate: () => void;
  venueId?: string;
}

const Inventory: React.FC<InventoryProps> = ({ inventory, bookings, onUpdate, venueId }) => {
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<number | ''>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice || Number(newItemPrice) <= 0) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('inventory')
        .insert({
          name: newItemName.trim(),
          price: Number(newItemPrice),
          venue_id: venueId
        });

      if (error) throw error;
      setNewItemName('');
      setNewItemPrice(0);
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Failed to add item');
    } finally {
      setIsProcessing(false);
    }
  };

  const removeItem = async (id: string) => {
    if (!confirm("Delete this inventory item?")) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id);
      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Failed to delete item');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateItemPrice = async (id: string, price: number) => {
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ price })
        .eq('id', id);
      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Inventory Management
          </h2>
          {isProcessing && <Loader2 className="w-4 h-4 text-white/50 animate-spin" />}
        </div>

        <div className="p-6">
          <form onSubmit={addItem} className="flex flex-wrap md:flex-nowrap gap-3 mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex-1 min-w-[200px] space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-widest">Drink Name</label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Red Bull"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                  required
                />
              </div>
            </div>
            <div className="w-full md:w-32 space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-widest">Price (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  placeholder="0"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isProcessing}
              className="md:mt-5 px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 shrink-0 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </form>

          <div className="space-y-3">
            <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider px-2 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              Current Stock
            </h3>
            {inventory.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-3xl text-slate-400 italic">
                No items in inventory.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {inventory.map((item) => (
                  <div key={item.id} className="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-200 transition-all hover:shadow-md">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                        <Package className="text-indigo-600 w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{item.name}</p>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Live</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="relative w-32">
                         <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                         <input
                          type="number"
                          value={item.price}
                          onBlur={(e) => updateItemPrice(item.id, Number(e.target.value))}
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                         />
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
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
