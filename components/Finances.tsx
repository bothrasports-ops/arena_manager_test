import React, { useMemo, useState } from 'react';
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
    Calendar,
    Clock,
    ChevronDown,
    Users,
    Download,
    FileText,
    Table as TableIcon
} from 'lucide-react';
import { Booking, DrinkInventoryItem, Platform, Sport, PosSale, Member, Student, BookingType } from '../types';
import { exportToCSV, exportToExcel, exportToPDF } from '../lib/exportUtils';
import { toast } from 'sonner';

interface FinancesProps {
    bookings: Booking[];
    inventory: DrinkInventoryItem[];
    posSales: PosSale[];
    members: Member[];
    students: Student[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

type TimeRange = 'all' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const Finances: React.FC<FinancesProps> = ({ bookings, inventory, posSales, members, students }) => {
    const [timeRange, setTimeRange] = useState<TimeRange>('all');

    const filteredData = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const currentQuarter = Math.floor(currentMonth / 3);

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const isInRange = (dateInput: string | number) => {
            if (timeRange === 'all') return true;
            const date = new Date(dateInput);
            switch (timeRange) {
                case 'daily':
                    return date.toDateString() === now.toDateString();
                case 'weekly':
                    return date >= startOfWeek;
                case 'monthly':
                    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
                case 'quarterly':
                    return Math.floor(date.getMonth() / 3) === currentQuarter && date.getFullYear() === currentYear;
                case 'yearly':
                    return date.getFullYear() === currentYear;
                default:
                    return true;
            }
        };

        const filteredBookings = bookings.filter(b => isInRange(b.timestamp));
        const filteredPosSales = posSales.filter(s => isInRange(s.createdAt));

        return { filteredBookings, filteredPosSales };
    }, [bookings, posSales, timeRange]);

    const { filteredBookings, filteredPosSales } = filteredData;

    // 1. Revenue by Sport
    const revenueBySport = useMemo(() => {
        const data: Record<string, number> = {};
        filteredBookings.forEach(b => {
            data[b.sport] = (data[b.sport] || 0) + b.totalAmount;
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [filteredBookings]);

    // 2. Bookings by Sport (Count)
    const bookingsBySport = useMemo(() => {
        const data: Record<string, number> = {};
        filteredBookings.forEach(b => {
            data[b.sport] = (data[b.sport] || 0) + 1;
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [filteredBookings]);

    // 3. Platform-wise booking percentage
    const platformData = useMemo(() => {
        const data: Record<string, number> = {};
        filteredBookings.forEach(b => {
            data[b.platform] = (data[b.platform] || 0) + 1;
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [filteredBookings]);

    // 4. Earnings from each item sold (Bookings + POS)
    const inventoryRevenue = useMemo(() => {
        const data: Record<string, number> = {};

        // Add from bookings
        filteredBookings.forEach(b => {
            b.selectedDrinks.forEach(sd => {
                const item = inventory.find(i => i.id === sd.drinkId);
                const itemName = item ? item.name : 'Unknown Item';
                data[itemName] = (data[itemName] || 0) + (sd.priceAtTime * Number(sd.quantity || 0));
            });
        });

        // Add from POS sales
        filteredPosSales.forEach(sale => {
            sale.items.forEach((item: any) => {
                const invItem = inventory.find(i => i.id === item.drinkId);
                const itemName = invItem ? invItem.name : 'Unknown Item';
                data[itemName] = (data[itemName] || 0) + (item.priceAtTime * item.quantity);
            });
        });

        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [filteredBookings, inventory, filteredPosSales]);

    // CATEGORIZED REVENUE CALCULATION
    const revenueBreakdown = useMemo(() => {
        let courtRevenue = 0;
        let membershipRevenue = 0;
        let coachingRevenue = 0;

        filteredBookings.forEach(b => {
            const type = b.bookingType || BookingType.COURT;
            if (type === BookingType.COURT) courtRevenue += b.totalAmount;
            else if (type === BookingType.MEMBERSHIP) membershipRevenue += b.totalAmount;
            else if (type === BookingType.COACHING) coachingRevenue += b.totalAmount;
        });

        const drinkRevenue = inventoryRevenue.reduce((sum, item) => sum + item.value, 0);

        return [
            { name: 'Court Bookings', value: courtRevenue, color: '#6366f1' },
            { name: 'Memberships', value: membershipRevenue, color: '#8b5cf6' },
            { name: 'Coaching', value: coachingRevenue, color: '#f59e0b' },
            { name: 'Drink Sales', value: drinkRevenue, color: '#10b981' }
        ];
    }, [filteredBookings, inventoryRevenue]);

    const totalBookingRevenueCount = useMemo(() => filteredBookings.filter(b => (b.bookingType || BookingType.COURT) === BookingType.COURT).length, [filteredBookings]);
    const totalRevenue = revenueBreakdown.reduce((sum, item) => sum + item.value, 0);

    // Active counts
    const activeMembers = members.filter(m => m.status === 'active' || m.status === 'renewal_required').length;
    const expiredMembers = members.filter(m => m.status === 'expired').length;
    const activeStudents = students.filter(s => s.status === 'active').length;
    const expiredStudents = students.filter(s => s.status === 'expired').length;

    const [showExportMenu, setShowExportMenu] = useState(false);

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const fileName = `VenueIQ_Finances_${timeRange}_${new Date().toISOString().split('T')[0]}`;

        // Revenue Categories
        const revenueData = revenueBreakdown.map(item => ({
            Category: item.name,
            Revenue_Amount: item.value
        }));

        // Sport Distribution
        const sportData = bookingsBySport.map(item => ({
            Sport: item.name,
            Booking_Count: item.value,
            Revenue_Contribution: revenueBySport.find(rb => rb.name === item.name)?.value || 0
        }));

        // Platform Data
        const platformsExport = platformData.map(item => ({
            Platform: item.name,
            Transactions: item.value
        }));

        // Inventory Data
        const inventoryExport = inventoryRevenue.map(item => ({
            Item_Name: item.name,
            Revenue: item.value
        }));

        // Combine for generic export or focus on most important
        const fullReport = [
            { Section: 'EXECUTIVE SUMMARY', Value: '' },
            { Section: 'Total Revenue', Value: totalRevenue },
            { Section: 'Court Bookings Count', Value: totalBookingRevenueCount },
            { Section: 'Active Memberships', Value: activeMembers },
            { Section: 'Active Students', Value: activeStudents },
            { Section: '', Value: '' },
            { Section: 'REVENUE BREAKDOWN', Value: '' },
            ...revenueData.map(r => ({ Section: r.Category, Value: r.Revenue_Amount })),
            { Section: '', Value: '' },
            { Section: 'SPORT PERFORMANCE', Value: '' },
            ...sportData.map(s => ({ Section: s.Sport, Value: `Bookings: ${s.Booking_Count}, Revenue: ${s.Revenue_Contribution}` })),
        ];

        try {
            if (format === 'csv') exportToCSV(fullReport, fileName);
            else if (format === 'excel') exportToExcel(fullReport, fileName);
            else if (format === 'pdf') exportToPDF(fullReport, fileName, `VenueIQ Financial Report - ${timeRange.toUpperCase()}`);

            toast.success(`Financial report exported as ${format.toUpperCase()}`);
            setShowExportMenu(false);
        } catch (error) {
            toast.error('Failed to export report');
            console.error(error);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Time Range Filter */}
            <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="w-full md:w-1/3 flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                            <Clock className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">Financial Period</h3>
                            <p className="text-xs text-slate-500 font-medium">Viewing {timeRange === 'all' ? 'lifetime' : timeRange} data</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-100 transition-all"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Export</span>
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <button
                                        onClick={() => handleExport('csv')}
                                        className="w-full px-4 py-2 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                                    >
                                        <FileText className="w-4 h-4" />
                                        CSV Report
                                    </button>
                                    <button
                                        onClick={() => handleExport('excel')}
                                        className="w-full px-4 py-2 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                                    >
                                        <TableIcon className="w-4 h-4 text-emerald-600" />
                                        Excel Spreadsheet
                                    </button>
                                    <button
                                        onClick={() => handleExport('pdf')}
                                        className="w-full px-4 py-2 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                                    >
                                        <FileText className="w-4 h-4 text-rose-600" />
                                        PDF Document
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="relative group">
                            <select
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                                className="appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-4 pr-10 py-2.5 outline-none cursor-pointer hover:bg-slate-100 transition-all"
                            >
                                <option value="all">Lifetime</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm col-span-1 md:col-span-1">
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
                        <div className="p-3 bg-blue-50 rounded-xl">
                            <Calendar className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Court Bookings</p>
                            <p className="text-2xl font-black text-slate-900">{totalBookingRevenueCount}</p>
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-indigo-600 uppercase">₹{revenueBreakdown.find(r => r.name === 'Court Bookings')?.value.toLocaleString()}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-purple-50 rounded-xl">
                            <Users className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Memberships</p>
                            <p className="text-2xl font-black text-slate-900">{activeMembers}</p>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black text-purple-600 uppercase">₹{revenueBreakdown.find(r => r.name === 'Memberships')?.value.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-rose-400 uppercase">Exp: {expiredMembers}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-amber-50 rounded-xl">
                            <Zap className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Coaching</p>
                            <p className="text-2xl font-black text-slate-900">{activeStudents}</p>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black text-amber-600 uppercase">₹{revenueBreakdown.find(r => r.name === 'Coaching')?.value.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-rose-400 uppercase">Exp: {expiredStudents}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue Distribution */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <PieChart className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-lg font-black text-slate-900">Revenue Distribution</h3>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={revenueBreakdown}
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {revenueBreakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: any) => `₹${Number(value || 0).toLocaleString()}`}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Booking Distribution by Sport */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <Zap className="w-5 h-5 text-indigo-600" />
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
