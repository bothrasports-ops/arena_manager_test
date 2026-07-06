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
    TrendingDown,
    Coins,
    IndianRupee,
    Zap,
    Smartphone,
    ShoppingBag,
    Calendar,
    Clock,
    ChevronDown,
    Users,
    Download,
    FileText,
    Table as TableIcon,
    Scale,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { Booking, DrinkInventoryItem, Platform, Sport, PosSale, Member, Student, BookingType, PaymentMethod, MembershipPlanDefinition, Expense } from '../types';
import { exportToCSV, exportToExcel, exportToPDF } from '../lib/exportUtil';
import { getAvailableMonths, formatMonthLabel, calculateMonthStats } from '../lib/comparisonUtil';
import { toast } from 'sonner';

interface FinancesProps {
    bookings: Booking[];
    inventory: DrinkInventoryItem[];
    posSales: PosSale[];
    members: Member[];
    students: Student[];
    membershipPlans: MembershipPlanDefinition[];
    expenses?: Expense[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

type TimeRange = 'all' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const Finances: React.FC<FinancesProps> = ({ bookings, inventory, posSales, members, students, membershipPlans, expenses = [] }) => {
    const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
    const [compareMode, setCompareMode] = useState<boolean>(false);

    // Available months derived from existing datasets
    const availableMonths = useMemo(() => getAvailableMonths(bookings, posSales, expenses), [bookings, posSales, expenses]);

    // Default monthA to the current month or first available month
    const [monthA, setMonthA] = useState<string>(() => {
        const now = new Date();
        const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return availableMonths.includes(current) ? current : (availableMonths[0] || current);
    });

    // Default monthB to previous month
    const [monthB, setMonthB] = useState<string>(() => {
        const now = new Date();
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return availableMonths.includes(prev) ? prev : (availableMonths[1] || availableMonths[0] || prev);
    });

    const comparisonData = useMemo(() => {
        if (!compareMode) return null;
        const statsA = calculateMonthStats(monthA, bookings, inventory, posSales, members, students, membershipPlans, expenses, 'All');
        const statsB = calculateMonthStats(monthB, bookings, inventory, posSales, members, students, membershipPlans, expenses, 'All');

        const calculateDiff = (valA: number, valB: number) => {
            const diff = valA - valB;
            const pct = valB !== 0 ? (diff / valB) * 100 : 0;
            return { diff, pct };
        };

        return {
            statsA,
            statsB,
            revenue: calculateDiff(statsA.totalRevenue, statsB.totalRevenue),
            expenses: calculateDiff(statsA.totalExpenses, statsB.totalExpenses),
            profit: calculateDiff(statsA.totalProfit, statsB.totalProfit),
            drinksSold: calculateDiff(statsA.totalDrinksSold, statsB.totalDrinksSold),
            bookingsCount: calculateDiff(statsA.bookingCount, statsB.bookingCount),
            courtRevenue: calculateDiff(statsA.totalBookingRevenue, statsB.totalBookingRevenue),
            membershipRevenue: calculateDiff(statsA.totalMembershipRevenue, statsB.totalMembershipRevenue),
            coachingRevenue: calculateDiff(statsA.totalCoachingRevenue, statsB.totalCoachingRevenue),
            drinkRevenue: calculateDiff(statsA.totalDrinkRevenue, statsB.totalDrinkRevenue),
        };
    }, [compareMode, monthA, monthB, bookings, inventory, posSales, members, students, membershipPlans, expenses]);

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
        const filteredMembers = members.filter(m => m.startDate ? isInRange(m.startDate) : true);
        const filteredStudents = students.filter(s => s.startDate ? isInRange(s.startDate) : true);
        const filteredExpenses = expenses.filter(e => isInRange(e.expenseDate));

        return { filteredBookings, filteredPosSales, filteredMembers, filteredStudents, filteredExpenses };
    }, [bookings, posSales, members, students, timeRange, expenses]);

    const { filteredBookings, filteredPosSales, filteredMembers, filteredStudents, filteredExpenses } = filteredData;

    // 1. Revenue by Sport
    const revenueBySport = useMemo(() => {
        const data: Record<string, number> = {};
        filteredBookings.forEach(b => {
            const amount = Number(b.bookingAmount) + (b.extraHours?.enabled ? Number(b.extraHours.amount) : 0);
            data[b.sport] = (data[b.sport] || 0) + amount;
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
            if (type === BookingType.COURT) {
                courtRevenue += Number(b.bookingAmount) + (b.extraHours?.enabled ? Number(b.extraHours.amount) : 0);
            } else if (type === BookingType.MEMBERSHIP) {
                membershipRevenue += Number(b.bookingAmount);
            } else if (type === BookingType.COACHING) {
                coachingRevenue += Number(b.coachingFee || b.bookingAmount || 0);
            }
        });

        // Add independent Members table revenue
        filteredMembers.forEach(member => {
            const planName = member.plan || 'Monthly';
            const matchedPlan = membershipPlans?.find(p =>
                p.sport === member.sport &&
                (p.name?.toLowerCase() === planName.toLowerCase() ||
                    p.duration?.toLowerCase() === planName.toLowerCase())
            );
            const price = matchedPlan ? matchedPlan.price : (
                planName.toLowerCase() === 'monthly' ? 1500 :
                    planName.toLowerCase() === 'quarterly' ? 4000 :
                        planName.toLowerCase() === 'yearly' ? 12000 : 1000
            );
            membershipRevenue += price;
        });

        // Add independent Coaching table revenue
        filteredStudents.forEach(student => {
            coachingRevenue += Number(student.coachingFee || 0);
        });

        const drinkRevenue = inventoryRevenue.reduce((sum, item) => sum + item.value, 0);

        return [
            { name: 'Court Bookings', value: courtRevenue, color: '#6366f1' },
            { name: 'Memberships', value: membershipRevenue, color: '#8b5cf6' },
            { name: 'Coaching', value: coachingRevenue, color: '#f59e0b' },
            { name: 'Drink Sales', value: drinkRevenue, color: '#10b981' }
        ];
    }, [filteredBookings, filteredMembers, filteredStudents, inventoryRevenue, membershipPlans]);

    const totalBookingRevenueCount = useMemo(() => filteredBookings.filter(b => (b.bookingType || BookingType.COURT) === BookingType.COURT).length, [filteredBookings]);
    const totalRevenue = revenueBreakdown.reduce((sum, item) => sum + item.value, 0);

    const totalExpenses = useMemo(() => {
        return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    }, [filteredExpenses]);

    const totalDrinkCost = useMemo(() => {
        let cost = 0;
        filteredBookings.forEach(b => {
            b.selectedDrinks.forEach(sd => {
                const item = inventory.find(i => i.id === sd.drinkId);
                if (item) {
                    cost += (item.purchasePrice || 0) * Number(sd.quantity || 0);
                }
            });
        });
        filteredPosSales.forEach(sale => {
            sale.items.forEach(item => {
                const invItem = inventory.find(i => i.id === item.drinkId);
                if (invItem) {
                    cost += (invItem.purchasePrice || 0) * Number(item.quantity || 0);
                }
            });
        });
        return cost;
    }, [filteredBookings, filteredPosSales, inventory]);

    const totalProfit = useMemo(() => {
        return totalRevenue - totalDrinkCost - totalExpenses;
    }, [totalRevenue, totalDrinkCost, totalExpenses]);

    // Payment Method Breakdown
    const paymentMethodRevenue = useMemo(() => {
        const data: Record<string, number> = {};

        // Initialize with all methods
        Object.values(PaymentMethod).forEach(method => {
            data[method] = 0;
        });

        filteredBookings.forEach(booking => {
            const method1 = booking.paymentMethod;
            const method2 = booking.finalPaymentMethod;
            const advance = Number(booking.advancePaid || 0);
            const balance = Number(booking.balancePaid || 0);

            if (booking.status === 'completed' && method2) {
                if (method1 && method1 !== method2) {
                    // Split between two methods
                    const bAmount = balance;
                    const aAmount = advance - bAmount;
                    data[method1] = (data[method1] || 0) + aAmount;
                    data[method2] = (data[method2] || 0) + bAmount;
                } else {
                    // Single method (either method1 was null or same as method2)
                    const targetMethod = method2 || method1;
                    if (targetMethod) {
                        data[targetMethod] = (data[targetMethod] || 0) + advance;
                    }
                }
            } else if (method1) {
                // Not completed, or completed without method2 (fully prepaid at start)
                data[method1] = (data[method1] || 0) + advance;
            }
        });

        filteredPosSales.forEach(sale => {
            if (sale.paymentMethod) {
                data[sale.paymentMethod] = (data[sale.paymentMethod] || 0) + sale.totalAmount;
            }
        });

        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [filteredBookings, filteredPosSales]);

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
            { Section: 'Total Expenses', Value: totalExpenses },
            { Section: 'Estimated Net Profit', Value: totalProfit },
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
            {/* Filters & Comparison Selector */}
            <div className="flex flex-col xl:flex-row items-center gap-4">
                {/* MoM Comparison Selector */}
                <div className="flex-1 w-full flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mr-auto">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${compareMode ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                            <Scale className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900">Month Comparison Mode</h3>
                            <p className="text-xs text-slate-500 font-medium">
                                {compareMode ? 'Comparing two custom periods' : 'Compare custom months side-by-side'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => setCompareMode(!compareMode)}
                            className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all border flex items-center gap-2 cursor-pointer ${compareMode ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                            <span>{compareMode ? '✓ Comparison Active' : '📊 Compare Months'}</span>
                        </button>

                        {compareMode && (
                            <div className="flex items-center gap-2 w-full sm:w-auto animate-in fade-in zoom-in-95 duration-200">
                                <div className="relative group flex-1 sm:flex-initial">
                                    <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold text-indigo-500 z-10">Base Month</span>
                                    <select
                                        value={monthA}
                                        onChange={(e) => setMonthA(e.target.value)}
                                        className="appearance-none bg-slate-50 border border-indigo-200 text-slate-900 text-xs font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block pl-3 pr-8 py-2 outline-none cursor-pointer hover:bg-indigo-50/50 transition-all"
                                    >
                                        {availableMonths.map(m => (
                                            <option key={m} value={m}>{formatMonthLabel(m)}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400 pointer-events-none" />
                                </div>

                                <span className="text-slate-400 font-bold text-xs shrink-0">vs</span>

                                <div className="relative group flex-1 sm:flex-initial">
                                    <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold text-indigo-500 z-10">Compare with</span>
                                    <select
                                        value={monthB}
                                        onChange={(e) => setMonthB(e.target.value)}
                                        className="appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block pl-3 pr-8 py-2 outline-none cursor-pointer hover:bg-slate-100 transition-all"
                                    >
                                        {availableMonths.map(m => (
                                            <option key={m} value={m}>{formatMonthLabel(m)}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Regular TimeRange filter (only visible if compareMode is false) */}
                {!compareMode && (
                    <div className="w-full xl:w-auto flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                                <Clock className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="mr-4">
                                <h3 className="text-sm font-bold text-slate-900">Period</h3>
                                <p className="text-xs text-slate-500 font-medium">{timeRange === 'all' ? 'lifetime' : timeRange}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative group">
                                <select
                                    value={timeRange}
                                    onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                                    className="appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block pl-3 pr-8 py-2 outline-none cursor-pointer hover:bg-slate-100 transition-all"
                                >
                                    <option value="all">Lifetime</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                    <option value="yearly">Yearly</option>
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Export Button Block */}
                <div className="w-full xl:w-auto bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between shrink-0">
                    <div className="relative">
                        <button
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export</span>
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
                </div>
            </div>

            {compareMode && comparisonData ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Comparison Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ComparisonStatCard
                            title="Total Revenue"
                            valA={comparisonData.statsA.totalRevenue}
                            valB={comparisonData.statsB.totalRevenue}
                            diff={comparisonData.revenue.diff}
                            pct={comparisonData.revenue.pct}
                            monthA={formatMonthLabel(monthA)}
                            monthB={formatMonthLabel(monthB)}
                            isCurrency={true}
                            color="emerald"
                        />
                        <ComparisonStatCard
                            title="Operating Expenses"
                            valA={comparisonData.statsA.totalExpenses}
                            valB={comparisonData.statsB.totalExpenses}
                            diff={comparisonData.expenses.diff}
                            pct={comparisonData.expenses.pct}
                            monthA={formatMonthLabel(monthA)}
                            monthB={formatMonthLabel(monthB)}
                            isCurrency={true}
                            color="rose"
                            invertColors={true}
                        />
                        <ComparisonStatCard
                            title="Net Profit"
                            valA={comparisonData.statsA.totalProfit}
                            valB={comparisonData.statsB.totalProfit}
                            diff={comparisonData.profit.diff}
                            pct={comparisonData.profit.pct}
                            monthA={formatMonthLabel(monthA)}
                            monthB={formatMonthLabel(monthB)}
                            isCurrency={true}
                            color="indigo"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ComparisonStatCard
                            title="Total Bookings"
                            valA={comparisonData.statsA.bookingCount}
                            valB={comparisonData.statsB.bookingCount}
                            diff={comparisonData.bookingsCount.diff}
                            pct={comparisonData.bookingsCount.pct}
                            monthA={formatMonthLabel(monthA)}
                            monthB={formatMonthLabel(monthB)}
                            isCurrency={false}
                            color="amber"
                        />
                        <ComparisonStatCard
                            title="Drinks Sold"
                            valA={comparisonData.statsA.totalDrinksSold}
                            valB={comparisonData.statsB.totalDrinksSold}
                            diff={comparisonData.drinksSold.diff}
                            pct={comparisonData.drinksSold.pct}
                            monthA={formatMonthLabel(monthA)}
                            monthB={formatMonthLabel(monthB)}
                            isCurrency={false}
                            color="indigo"
                        />
                    </div>

                    {/* Visual Comparison Chart */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <TableIcon className="w-5 h-5 text-indigo-600" />
                            <div>
                                <h3 className="text-base font-black text-slate-900">Revenue Component Breakdown</h3>
                                <p className="text-xs text-slate-500 font-medium">Side-by-side performance of revenue sectors and expenses</p>
                            </div>
                        </div>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[
                                        {
                                            name: 'Court Bookings',
                                            [formatMonthLabel(monthA)]: comparisonData.statsA.totalBookingRevenue,
                                            [formatMonthLabel(monthB)]: comparisonData.statsB.totalBookingRevenue,
                                        },
                                        {
                                            name: 'Memberships',
                                            [formatMonthLabel(monthA)]: comparisonData.statsA.totalMembershipRevenue,
                                            [formatMonthLabel(monthB)]: comparisonData.statsB.totalMembershipRevenue,
                                        },
                                        {
                                            name: 'Coaching Fees',
                                            [formatMonthLabel(monthA)]: comparisonData.statsA.totalCoachingRevenue,
                                            [formatMonthLabel(monthB)]: comparisonData.statsB.totalCoachingRevenue,
                                        },
                                        {
                                            name: 'Drink Sales',
                                            [formatMonthLabel(monthA)]: comparisonData.statsA.totalDrinkRevenue,
                                            [formatMonthLabel(monthB)]: comparisonData.statsB.totalDrinkRevenue,
                                        },
                                        {
                                            name: 'Expenses',
                                            [formatMonthLabel(monthA)]: comparisonData.statsA.totalExpenses,
                                            [formatMonthLabel(monthB)]: comparisonData.statsB.totalExpenses,
                                        }
                                    ]}
                                    margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value.toLocaleString()}`} />
                                    <Tooltip formatter={(value: any) => `₹${Number(value).toLocaleString()}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Legend />
                                    <Bar dataKey={formatMonthLabel(monthA)} fill="#6366f1" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey={formatMonthLabel(monthB)} fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* MoM Detailed Comparison Table */}
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="bg-slate-900 px-6 py-4">
                            <h3 className="text-white font-bold text-base flex items-center gap-2">
                                <TableIcon className="w-4 h-4" />
                                Line-by-Line Revenue & Profit Comparison Statement
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    <th className="py-4 px-6">Line Item / Metric</th>
                                    <th className="py-4 px-6 text-right">{formatMonthLabel(monthA)} (Base)</th>
                                    <th className="py-4 px-6 text-right">{formatMonthLabel(monthB)} (Compare)</th>
                                    <th className="py-4 px-6 text-right">Variance</th>
                                    <th className="py-4 px-6 text-right">Variance %</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                <ComparisonTableRow label="Court Rental Bookings" valA={comparisonData.statsA.totalBookingRevenue} valB={comparisonData.statsB.totalBookingRevenue} isCurrency={true} />
                                <ComparisonTableRow label="Membership Collections" valA={comparisonData.statsA.totalMembershipRevenue} valB={comparisonData.statsB.totalMembershipRevenue} isCurrency={true} />
                                <ComparisonTableRow label="Coaching Academy Fees" valA={comparisonData.statsA.totalCoachingRevenue} valB={comparisonData.statsB.totalCoachingRevenue} isCurrency={true} />
                                <ComparisonTableRow label="Beverage & Snacks Sales" valA={comparisonData.statsA.totalDrinkRevenue} valB={comparisonData.statsB.totalDrinkRevenue} isCurrency={true} />
                                <tr className="bg-indigo-50/30 font-bold border-t border-indigo-100">
                                    <td className="py-4 px-6 text-indigo-950">Total Gross Revenue</td>
                                    <td className="py-4 px-6 text-right text-indigo-950">₹{comparisonData.statsA.totalRevenue.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right text-slate-600">₹{comparisonData.statsB.totalRevenue.toLocaleString()}</td>
                                    <td className={`py-4 px-6 text-right ${comparisonData.revenue.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {comparisonData.revenue.diff >= 0 ? '+' : ''}₹{comparisonData.revenue.diff.toLocaleString()}
                                    </td>
                                    <td className={`py-4 px-6 text-right ${comparisonData.revenue.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {comparisonData.revenue.diff >= 0 ? '▲' : '▼'} {comparisonData.revenue.pct.toFixed(1)}%
                                    </td>
                                </tr>
                                <ComparisonTableRow label="Wholesale Drinks Cost Price" valA={comparisonData.statsA.totalDrinkCost} valB={comparisonData.statsB.totalDrinkCost} isCurrency={true} invertTrend={true} />
                                <ComparisonTableRow label="Logged Operating Expenses" valA={comparisonData.statsA.totalExpenses} valB={comparisonData.statsB.totalExpenses} isCurrency={true} invertTrend={true} />
                                <tr className="bg-emerald-50/50 font-extrabold border-t border-emerald-100 text-base">
                                    <td className="py-4 px-6 text-emerald-950">Estimated Net Profit</td>
                                    <td className="py-4 px-6 text-right text-emerald-950">₹{comparisonData.statsA.totalProfit.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right text-slate-600">₹{comparisonData.statsB.totalProfit.toLocaleString()}</td>
                                    <td className={`py-4 px-6 text-right ${comparisonData.profit.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {comparisonData.profit.diff >= 0 ? '+' : ''}₹{comparisonData.profit.diff.toLocaleString()}
                                    </td>
                                    <td className={`py-4 px-6 text-right ${comparisonData.profit.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {comparisonData.profit.diff >= 0 ? '▲' : '▼'} {comparisonData.profit.pct.toFixed(1)}%
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                                <span>Inclusive performance</span>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-rose-50 rounded-xl">
                                    <TrendingDown className="w-6 h-6 text-rose-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Expenses</p>
                                    <p className="text-2xl font-black text-rose-600">₹{totalExpenses.toLocaleString()}</p>
                                </div>
                            </div>
                            <p className="text-[10px] font-black text-rose-500 uppercase">Operational outflow</p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-emerald-50 rounded-xl">
                                    <Coins className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Net Profit</p>
                                    <p className="text-2xl font-black text-slate-900">₹{totalProfit.toLocaleString()}</p>
                                </div>
                            </div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase">Revenue - Outflows</p>
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
                                    <p className="text-slate-500 text-xs font-bold uppercase">Memberships</p>
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
                                    <p className="text-slate-500 text-xs font-bold uppercase">Coaching</p>
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

                        {/* Payment Method Share */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-6">
                                <IndianRupee className="w-5 h-5 text-indigo-600" />
                                <h3 className="text-lg font-black text-slate-900">Revenue by Payment Method</h3>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={paymentMethodRevenue}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={70}
                                            outerRadius={90}
                                            dataKey="value"
                                        >
                                            {paymentMethodRevenue.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
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
                    </div>
                </>
            )}
        </div>
    );
};

interface ComparisonStatCardProps {
    title: string;
    valA: number;
    valB: number;
    diff: number;
    pct: number;
    monthA: string;
    monthB: string;
    isCurrency: boolean;
    color: 'emerald' | 'indigo' | 'amber' | 'rose';
    invertColors?: boolean;
}

const ComparisonStatCard: React.FC<ComparisonStatCardProps> = ({
                                                                   title, valA, valB, diff, pct, monthA, monthB, isCurrency, color, invertColors = false
                                                               }) => {
    const isPositive = diff >= 0;
    const isBetter = invertColors ? !isPositive : isPositive;
    const isZero = diff === 0;

    const trendColor = isZero ? 'text-slate-500' : (isBetter ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50');
    const formatVal = (v: number) => isCurrency ? `₹${v.toLocaleString()}` : v.toString();

    return (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">{title}</p>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 ${trendColor}`}>
            {!isZero && (isPositive ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />)}
                        {isZero ? 'No Change' : `${isPositive ? '+' : ''}${pct.toFixed(1)}%`}
          </span>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-400 font-bold">{monthA} (Base)</span>
                        <span className="text-2xl font-black text-slate-900">{formatVal(valA)}</span>
                    </div>
                    <div className="flex justify-between items-baseline text-slate-400">
                        <span className="text-xs text-slate-400 font-medium">{monthB} (Compare)</span>
                        <span className="text-lg font-bold">{formatVal(valB)}</span>
                    </div>
                </div>
            </div>
            <div className="border-t border-slate-100 mt-4 pt-3 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase">Variance</span>
                <span className={`font-black ${isZero ? 'text-slate-500' : (isBetter ? 'text-emerald-600' : 'text-rose-600')}`}>
          {isPositive ? '+' : ''}{formatVal(diff)}
        </span>
            </div>
        </div>
    );
};

interface ComparisonTableRowProps {
    label: string;
    valA: number;
    valB: number;
    isCurrency: boolean;
    invertTrend?: boolean;
}

const ComparisonTableRow: React.FC<ComparisonTableRowProps> = ({ label, valA, valB, isCurrency, invertTrend = false }) => {
    const diff = valA - valB;
    const pct = valB !== 0 ? (diff / valB) * 100 : 0;
    const isPositive = diff >= 0;
    const isBetter = invertTrend ? !isPositive : isPositive;
    const isZero = diff === 0;

    const formatVal = (v: number) => isCurrency ? `₹${v.toLocaleString()}` : v.toString();

    return (
        <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="py-3 px-6 font-bold text-slate-700">{label}</td>
            <td className="py-3 px-6 text-right font-black text-slate-900">{formatVal(valA)}</td>
            <td className="py-3 px-6 text-right text-slate-500">{formatVal(valB)}</td>
            <td className={`py-3 px-6 text-right font-bold ${isZero ? 'text-slate-400' : (isBetter ? 'text-emerald-600' : 'text-rose-600')}`}>
                {isZero ? '-' : `${isPositive ? '+' : ''}${formatVal(diff)}`}
            </td>
            <td className={`py-3 px-6 text-right font-bold ${isZero ? 'text-slate-400' : (isBetter ? 'text-emerald-600' : 'text-rose-600')}`}>
                {isZero ? '0.0%' : `${isPositive ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`}
            </td>
        </tr>
    );
};

export default Finances;
