import React from 'react';
import {
    X,
    Printer,
    Trophy,
    Calendar,
    Clock,
    User,
    Phone,
    LayoutGrid
} from 'lucide-react';
import { Booking, DrinkInventoryItem, Court, BookingType } from '../types';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: Booking;
    inventory: DrinkInventoryItem[];
    courts: Court[];
    venueName?: string;
    venueEmail?: string;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({
                                                       isOpen,
                                                       onClose,
                                                       booking,
                                                       inventory,
                                                       courts,
                                                       venueName = 'VenueIQ',
                                                       venueEmail = 'contact@veneuiq.com'
                                                   }) => {
    if (!isOpen) return null;

    const court = courts.find(c => c.id === booking.courtId);
    const balanceDue = Math.max(0, booking.totalAmount - (booking.advancePaid || 0));

    const handlePrint = () => {
        // Small timeout to ensure UI has settled and focus is clear
        setTimeout(() => {
            window.focus();
            window.print();
        }, 100);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] invoice-container">
                {/* Header - Not Printed */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white print:hidden">
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <Printer className="w-5 h-5 text-indigo-600" />
                        Print Bill / Invoice
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-md"
                        >
                            <Printer className="w-4 h-4" />
                            Print
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Printable Content */}
                <div className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible" id="invoice-content">
                    <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page { margin: 0; size: auto; }
              body { 
                margin: 0; 
                background: white !important; 
              }
              body * { visibility: hidden; }
              #invoice-content, #invoice-content * { 
                visibility: visible; 
              }
              #invoice-content { 
                position: fixed; 
                left: 0; 
                top: 0; 
                width: 100vw;
                height: 100vh;
                padding: 40px !important;
                margin: 0 !important;
                background: white !important;
                z-index: 9999;
                overflow: visible !important;
              }
              .print\\:hidden, .no-print { display: none !important; }
            }
          `}} />

                    {/* Business Logo & Info */}
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="bg-indigo-600 p-1.5 rounded-lg">
                                    <Trophy className="text-white w-6 h-6" />
                                </div>
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{venueName}</h1>
                            </div>
                            <p className="text-sm text-slate-500 font-medium">Official Invoice & Receipt</p>
                            <p className="text-xs text-slate-400">{venueEmail}</p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Invoice ID</h3>
                            <p className="text-sm font-bold text-slate-900 mb-4">#{booking.id.slice(0, 8).toUpperCase()}</p>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Date</h3>
                            <p className="text-sm font-bold text-slate-900">{new Date(booking.timestamp).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-10 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Customer Details</h3>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-slate-700">
                                    <User className="w-4 h-4 text-slate-400" />
                                    <span className="font-bold">{booking.customerName}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Phone className="w-4 h-4 text-slate-400" />
                                    <span>{booking.phoneNumber}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Session Details</h3>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-slate-700">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <span className="font-bold">{booking.bookingDate}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <span className="font-bold">{booking.bookingStartTime} - {booking.bookingEndTime} ({booking.totalHours} hrs)</span>
                                </div>
                                {court && (
                                    <div className="flex items-center gap-2 text-sm text-indigo-600">
                                        <LayoutGrid className="w-4 h-4" />
                                        <span className="font-bold">{court.name} ({booking.sport})</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="mb-10">
                        <table className="w-full text-left">
                            <thead>
                            <tr className="border-b-2 border-slate-900">
                                <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                                <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qty/Dur</th>
                                <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Price</th>
                                <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            <tr>
                                <td className="py-4">
                                    <p className="text-sm font-bold text-slate-900">{booking.bookingType} Booking</p>
                                    <p className="text-xs text-slate-400">{booking.sport} &bull; {booking.platform}</p>
                                </td>
                                <td className="py-4 text-sm text-slate-600 text-center font-bold">{booking.totalHours}h</td>
                                <td className="py-4 text-sm text-slate-600 text-right">₹{booking.bookingAmount / booking.totalHours}</td>
                                <td className="py-4 text-sm font-bold text-slate-900 text-right">₹{booking.bookingAmount}</td>
                            </tr>

                            {booking.bookingType === BookingType.COACHING && booking.coachingFee !== undefined && booking.coachingFee > 0 && (
                                <tr>
                                    <td className="py-4">
                                        <p className="text-sm font-bold text-slate-900">Coaching Fee</p>
                                    </td>
                                    <td className="py-4 text-center">-</td>
                                    <td className="py-4 text-right">-</td>
                                    <td className="py-4 text-sm font-bold text-slate-900 text-right">₹{booking.coachingFee}</td>
                                </tr>
                            )}

                            {booking.extraHours?.enabled && booking.extraHours.amount > 0 && (
                                <tr>
                                    <td className="py-4">
                                        <p className="text-sm font-bold text-slate-900">Extra Duration</p>
                                        <p className="text-xs text-slate-400">Added session extension</p>
                                    </td>
                                    <td className="py-4 text-sm text-slate-600 text-center font-bold">+{booking.extraHours.duration}h</td>
                                    <td className="py-4 text-right">-</td>
                                    <td className="py-4 text-sm font-bold text-slate-900 text-right">₹{booking.extraHours.amount}</td>
                                </tr>
                            )}

                            {booking.selectedDrinks.map(sd => {
                                const item = inventory.find(i => i.id === sd.drinkId);
                                if (!sd.quantity || Number(sd.quantity) <= 0) return null;
                                return (
                                    <tr key={sd.drinkId}>
                                        <td className="py-4">
                                            <p className="text-sm font-bold text-slate-900">{item?.name || 'Drink/Item'}</p>
                                        </td>
                                        <td className="py-4 text-sm text-slate-600 text-center font-bold">x{sd.quantity}</td>
                                        <td className="py-4 text-sm text-slate-600 text-right">₹{sd.priceAtTime}</td>
                                        <td className="py-4 text-sm font-bold text-slate-900 text-right">₹{Number(sd.quantity) * Number(sd.priceAtTime)}</td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end">
                        <div className="w-64 space-y-3">
                            <div className="flex justify-between text-sm text-slate-500">
                                <span>Subtotal</span>
                                <span className="font-bold text-slate-900">₹{booking.totalAmount}</span>
                            </div>
                            <div className="flex justify-between text-sm text-emerald-600 font-bold">
                                <span>Paid (Advance)</span>
                                <span>-₹{booking.advancePaid || 0}</span>
                            </div>
                            <div className="h-px bg-slate-200 my-2" />
                            <div className="flex justify-between items-center bg-indigo-600 p-4 rounded-xl text-white">
                                <span className="text-xs font-black uppercase tracking-widest">Total Payable</span>
                                <span className="text-2xl font-black">₹{balanceDue}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-16 pt-8 border-t border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Thank you for playing with us!</p>
                        <p className="text-[10px] text-slate-300">This is a computer generated invoice and does not require a physical signature.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoiceModal;
