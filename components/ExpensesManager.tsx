import React, { useState, useMemo } from 'react';
import {
    Plus,
    Trash2,
    Edit2,
    TrendingDown,
    Calendar,
    Search,
    Filter,
    Tag,
    CreditCard,
    X,
    ArrowUpDown,
    PlusCircle,
    IndianRupee,
    AlertCircle,
    FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { Expense, PaymentMethod } from '../types';

interface ExpensesManagerProps {
    expenses: Expense[];
    onSave: (expenses: Expense[]) => void;
    venueId: string;
}

export const EXPENSE_CATEGORIES = [
    { value: 'Rent / Lease', color: 'bg-red-50 text-red-700 border-red-100', dot: 'bg-red-500' },
    { value: 'Utilities (Electricity/Water)', color: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
    { value: 'Maintenance / Repairs', color: 'bg-orange-50 text-orange-700 border-orange-100', dot: 'bg-orange-500' },
    { value: 'Equipment & Supplies', color: 'bg-blue-50 text-blue-700 border-blue-100', dot: 'bg-blue-500' },
    { value: 'Staff Salaries', color: 'bg-purple-50 text-purple-700 border-purple-100', dot: 'bg-purple-500' },
    { value: 'Marketing / Advertising', color: 'bg-pink-50 text-pink-700 border-pink-100', dot: 'bg-pink-500' },
    { value: 'Office / Softwares', color: 'bg-cyan-50 text-cyan-700 border-cyan-100', dot: 'bg-cyan-500' },
    { value: 'Other Operational', color: 'bg-slate-50 text-slate-700 border-slate-100', dot: 'bg-slate-500' },
];

const ExpensesManager: React.FC<ExpensesManagerProps> = ({ expenses, onSave, venueId }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].value);
    const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);

    // Filtering & Sorting State
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [methodFilter, setMethodFilter] = useState('All');
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Modal or editing states
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);

    const filteredExpenses = useMemo(() => {
        let result = [...expenses];

        if (searchTerm) {
            result = result.filter(e =>
                e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                e.category.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (categoryFilter !== 'All') {
            result = result.filter(e => e.category === categoryFilter);
        }

        if (methodFilter !== 'All') {
            result = result.filter(e => e.paymentMethod === methodFilter);
        }

        result.sort((a, b) => {
            if (sortBy === 'date') {
                const timeA = new Date(a.expenseDate).getTime();
                const timeB = new Date(b.expenseDate).getTime();
                return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
            } else {
                return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
            }
        });

        return result;
    }, [expenses, searchTerm, categoryFilter, methodFilter, sortBy, sortOrder]);

    const expenseStatsByFiltered = useMemo(() => {
        const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const count = filteredExpenses.length;

        // Grouped quantities
        const grouped: Record<string, number> = {};
        filteredExpenses.forEach(e => {
            grouped[e.category] = (grouped[e.category] || 0) + e.amount;
        });

        const highestCategory = Object.entries(grouped).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

        return { total, count, highestCategory };
    }, [filteredExpenses]);

    const handleCreateExpense = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description || !amount) {
            toast.error('Please enter description and amount');
            return;
        }

        const newExpense: Expense = {
            id: crypto.randomUUID(),
            venueId,
            description,
            amount: Number(amount),
            category,
            expenseDate,
            paymentMethod,
            createdAt: new Date().toISOString()
        };

        const updatedExpenses = [newExpense, ...expenses];
        onSave(updatedExpenses);

        // Clear fields
        setDescription('');
        setAmount('');
        setIsAddingNew(false);
        toast.success('Expense recorded successfully!');
    };

    const handleUpdateExpense = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingExpense) return;
        if (!editingExpense.description || !editingExpense.amount) {
            toast.error('Please enter description and amount');
            return;
        }

        const updatedExpenses = expenses.map(item =>
            item.id === editingExpense.id ? editingExpense : item
        );
        onSave(updatedExpenses);
        setEditingExpense(null);
        toast.success('Expense updated successfully!');
    };

    const handleDeleteExpense = (id: string, name: string) => {
        if (confirm(`Are you sure you want to delete "${name}"?`)) {
            const updatedExpenses = expenses.filter(e => e.id !== id);
            onSave(updatedExpenses);
            toast.success('Expense removed successfully');
        }
    };

    const toggleSort = (field: 'date' | 'amount') => {
        if (sortBy === field) {
            setSortOrder(order => order === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Upper Widgets Bento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-red-600">
                        <TrendingDown className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Filtered Total Expenses</p>
                        <p className="text-3xl font-black text-rose-600">₹{expenseStatsByFiltered.total.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Total Items Registered</p>
                        <p className="text-3xl font-black text-slate-900">{expenseStatsByFiltered.count}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-600">
                        <Tag className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Major Burn Category</p>
                        <p className="text-lg font-black text-slate-900 truncate max-w-[200px]" title={expenseStatsByFiltered.highestCategory}>
                            {expenseStatsByFiltered.highestCategory}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Operating Expenses</span>
                    <span className="text-xs font-semibold bg-red-100 border border-red-200 text-red-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Admin Only</span>
                </h2>

                <button
                    onClick={() => setIsAddingNew(true)}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-100 hover:shadow-rose-200 transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    <span>Record Expense</span>
                </button>
            </div>

            {/* Record New Expense Drawer overlay */}
            {isAddingNew && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white max-w-lg w-full rounded-2xl border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="bg-rose-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <TrendingDown className="w-5 h-5 text-rose-200" />
                                Record New Operating Expense
                            </h3>
                            <button onClick={() => setIsAddingNew(false)} className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateExpense} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Description / Details</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Electric Power Bill for May 2026"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-medium transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Amount (₹)</label>
                                    <div className="relative">
                                        <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            required
                                            type="number"
                                            min="1"
                                            placeholder="Amount in Rupees"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-black text-slate-900 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Expense Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        <input
                                            required
                                            type="date"
                                            value={expenseDate}
                                            onChange={e => setExpenseDate(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-bold text-slate-700 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                                    <div className="relative">
                                        <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        <select
                                            value={category}
                                            onChange={e => setCategory(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none appearance-none font-bold text-slate-700 transition-all"
                                        >
                                            {EXPENSE_CATEGORIES.map(cat => (
                                                <option key={cat.value} value={cat.value}>{cat.value}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Payment Method</label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        <select
                                            value={paymentMethod}
                                            onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none appearance-none font-bold text-slate-700 transition-all"
                                        >
                                            {Object.values(PaymentMethod).map(method => (
                                                <option key={method} value={method}>{method}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingNew(false)}
                                    className="px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-md shadow-rose-100 hover:shadow-rose-200 transition-all"
                                >
                                    Record Expense
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Expense Modal/Drawer Overlay */}
            {editingExpense && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white max-w-lg w-full rounded-2xl border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <Edit2 className="w-5 h-5 text-indigo-200" />
                                Modify Recorded Expense
                            </h3>
                            <button onClick={() => setEditingExpense(null)} className="text-white/85 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateExpense} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Description / Details</label>
                                <input
                                    required
                                    type="text"
                                    value={editingExpense.description}
                                    onChange={e => setEditingExpense({ ...editingExpense, description: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Amount (₹)</label>
                                    <div className="relative">
                                        <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            required
                                            type="number"
                                            min="1"
                                            value={editingExpense.amount}
                                            onChange={e => setEditingExpense({ ...editingExpense, amount: Number(e.target.value) })}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-900 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Expense Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            required
                                            type="date"
                                            value={editingExpense.expenseDate}
                                            onChange={e => setEditingExpense({ ...editingExpense, expenseDate: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                                    <select
                                        value={editingExpense.category}
                                        onChange={e => setEditingExpense({ ...editingExpense, category: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition-all"
                                    >
                                        {EXPENSE_CATEGORIES.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.value}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Payment Method</label>
                                    <select
                                        value={editingExpense.paymentMethod}
                                        onChange={e => setEditingExpense({ ...editingExpense, paymentMethod: e.target.value as PaymentMethod })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition-all"
                                    >
                                        {Object.values(PaymentMethod).map(method => (
                                            <option key={method} value={method}>{method}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setEditingExpense(null)}
                                    className="px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Main Filter & Table Area */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">

                {/* Dynamic Filters Bar */}
                <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search description, categories, etc..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm transition-all font-medium text-slate-700"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">

                        {/* Category selection */}
                        <div className="relative">
                            <select
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                                className="appearance-none bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl pl-3 pr-8 py-2 outline-none cursor-pointer hover:border-slate-300 transition-colors"
                            >
                                <option value="All">All Categories</option>
                                {EXPENSE_CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.value}</option>
                                ))}
                            </select>
                            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Payment method selection */}
                        <div className="relative">
                            <select
                                value={methodFilter}
                                onChange={e => setMethodFilter(e.target.value)}
                                className="appearance-none bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl pl-3 pr-8 py-2 outline-none cursor-pointer hover:border-slate-300 transition-colors"
                            >
                                <option value="All">All Payment Methods</option>
                                {Object.values(PaymentMethod).map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            <CreditCard className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Clear filters trigger */}
                        {(searchTerm || categoryFilter !== 'All' || methodFilter !== 'All') && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setCategoryFilter('All');
                                    setMethodFilter('All');
                                }}
                                className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-bold px-2 py-2 bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-3 h-3" />
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* Expenses List / Table view */}
                {filteredExpenses.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                            <tr className="border-b border-slate-200/60 bg-slate-50/70 text-xs font-black text-slate-400 uppercase tracking-wider">
                                <th className="px-6 py-4 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => toggleSort('date')}>
                                    <div className="flex items-center gap-1">
                                        <span>Date</span>
                                        <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                                    </div>
                                </th>
                                <th className="px-6 py-4">Details</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Method</th>
                                <th className="px-6 py-4 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => toggleSort('amount')}>
                                    <div className="flex items-center gap-1">
                                        <span>Amount</span>
                                        <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {filteredExpenses.map((expense) => {
                                const catMatch = EXPENSE_CATEGORIES.find(c => c.value === expense.category) || {
                                    color: 'bg-slate-50 text-slate-700 border-slate-100',
                                    dot: 'bg-slate-500'
                                };

                                return (
                                    <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 text-xs font-bold text-slate-700 whitespace-nowrap">
                                            {new Date(expense.expenseDate).toLocaleDateString('default', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-slate-800 select-all">{expense.description}</p>
                                        </td>
                                        <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${catMatch.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${catMatch.dot}`} />
                            {expense.category}
                        </span>
                                        </td>
                                        <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-600 block bg-slate-100/70 border border-slate-200/50 rounded-lg px-2 py-0.5 w-max">
                          {expense.paymentMethod || 'Cash'}
                        </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-black text-slate-900">₹{expense.amount.toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => setEditingExpense(expense)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent rounded-lg transition-all"
                                                    title="Edit details"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteExpense(expense.id, expense.description)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent rounded-lg transition-all"
                                                    title="Delete expense"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-16 text-center space-y-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <p className="text-slate-500 font-bold text-sm">No expenses match your search or filters.</p>
                        <p className="text-slate-400 text-xs">Record a new expense using the "Record Expense" button on the top right.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExpensesManager;
