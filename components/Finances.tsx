import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import {
    TrendingUp,
    IndianRupee,
    Trophy,
    Smartphone,
    ShoppingBag,
    Calendar
} from 'lucide-react';
import { Booking, DrinkInventoryItem, Platform, Sport, PosSale } from '../types';

interface FinancesProps {
    bookings: Booking[];
    inventory: DrinkInventoryItem[];
    posSales: PosSale[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const Finances: React.FC<FinancesProps> = ({ bookings, inventory, posSales }) => {
    // 1. Revenue by Sport
    const revenueBySport = useMemo(() => {
        const data: Record<string, number> = {};
        bookings.forEach(b => {
            data[b.sport] = (data[b.sport] || 0) + b.totalAmount;
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [bookings]);

    // 2. Bookings by Sport (Count)
    const bookingsBySport = useMemo(() => {
        const data: Record<string, number> = {};
        bookings.forEach(b => {
            data[b.sport] = (data[b.sport] || 0) + 1;
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [bookings]);

    // 3. Platform-wise booking percentage
    const platformData = useMemo(() => {
        const data: Record<string, number> = {};
        bookings.forEach(b => {
            data[b.platform] = (data[b.platform] || 0) + 1;
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [bookings]);

    // 4. Earnings from each item sold (Bookings + POS)
    const inventoryRevenue = useMemo(() => {
        const data: Record<string, number> = {};

        // Add from bookings
        bookings.forEach(b => {
            b.selectedDrinks.forEach(sd => {
                const item = inventory.find(i => i.id === sd.drinkId);
                const itemName = item ? item.name : 'Unknown Item';
                data[itemName] = (data[itemName] || 0) + (sd.priceAtTime * Number(sd.quantity || 0));
            });
        });

        // Add from POS sales
        posSales.forEach(sale => {
            sale.items.forEach((item: any) => {
                const invItem = inventory.find(i => i.id === item.drinkId);
                const itemName = invItem ? invItem.name : 'Unknown Item';
                data[itemName] = (data[itemName] || 0) + (item.priceAtTime * item.quantity);
            });
        });

        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [bookings, inventory, posSales]);

    const totalBookingRevenue = useMemo(() => bookings.reduce((sum, b) => sum + b.totalAmount, 0), [bookings]);
    const totalPosRevenue = useMemo(() => posSales.reduce((sum, s) => sum + s.totalAmount, 0), [posSales]);
    const totalRevenue = totalBookingRevenue + totalPosRevenue;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-indigo-50 rounded-xl">
                            <IndianRupee className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Total Revenue</p>
                            <p className="text-2xl font-black text-slate-900">₹{totalRevenue.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                        <TrendingUp className="w-3 h-3" />
                        <span>Lifetime Performance</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-emerald-50 rounded-xl">
                            <Calendar className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Total Bookings</p>
                            <p className="text-2xl font-black text-slate-900">{bookings.length}</p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400">Aggregated across all platforms</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-amber-50 rounded-xl">
                            <ShoppingBag className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Inventory Sales</p>
                            <p className="text-2xl font-black text-slate-900">
                                ₹{inventoryRevenue.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400">Total from drinks & snacks</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue by Sport */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <Trophy className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-lg font-black text-slate-900">Revenue by Sport</h3>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueBySport}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-xs font-bold" />
                                <YAxis axisLine={false} tickLine={false} className="text-xs font-bold" />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Booking Distribution by Sport */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <Trophy className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-lg font-black text-slate-900">Booking Distribution</h3>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={bookingsBySport}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {bookingsBySport.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Platform Share */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <Smartphone className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-lg font-black text-slate-900">Platform Performance</h3>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={platformData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || 'Unknown'} ${((percent || 0) * 100).toFixed(0)}%`}
                                >
                                    {platformData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Inventory Revenue Share */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <ShoppingBag className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-lg font-black text-slate-900">Inventory Items Revenue</h3>
                    </div>
                    <div className="h-[300px] w-full">
                        {inventoryRevenue.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={inventoryRevenue}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={90}
                                        dataKey="value"
                                    >
                                        {inventoryRevenue.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400 italic">
                                No inventory sales recorded yet
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Finances;
