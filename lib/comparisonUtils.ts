import { Booking, DrinkInventoryItem, PosSale, Member, Student, MembershipPlanDefinition, Expense, BookingType } from '../types';

export interface MonthStats {
    totalBookingRevenue: number;
    totalMembershipRevenue: number;
    totalCoachingRevenue: number;
    totalDrinkRevenue: number;
    totalDrinkCost: number;
    totalRevenue: number;
    totalExpenses: number;
    totalProfit: number;
    totalDrinksSold: number;
    bookingCount: number;
}

export const getAvailableMonths = (bookings: Booking[], posSales: PosSale[], expenses: Expense[]) => {
    const months = new Set<string>();

    // Add last 12 months by default
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        months.add(`${yyyy}-${mm}`);
    }

    // Add any other months from bookings
    bookings.forEach(b => {
        const dateInput = b.timestamp || b.bookingDate;
        if (dateInput) {
            const date = new Date(dateInput);
            if (!isNaN(date.getTime())) {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                months.add(`${yyyy}-${mm}`);
            }
        }
    });

    // Add from POS sales
    posSales.forEach(s => {
        if (s.createdAt) {
            const date = new Date(s.createdAt);
            if (!isNaN(date.getTime())) {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                months.add(`${yyyy}-${mm}`);
            }
        }
    });

    // Add from expenses
    expenses.forEach(e => {
        if (e.expenseDate) {
            const date = new Date(e.expenseDate);
            if (!isNaN(date.getTime())) {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                months.add(`${yyyy}-${mm}`);
            }
        }
    });

    return Array.from(months).sort((a, b) => b.localeCompare(a));
};

export const formatMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
};

export const calculateMonthStats = (
    monthStr: string,
    bookings: Booking[],
    inventory: DrinkInventoryItem[],
    posSales: PosSale[],
    members: Member[],
    students: Student[],
    membershipPlans: MembershipPlanDefinition[],
    expenses: Expense[] = [],
    sportFilter: string = 'All'
): MonthStats => {
    const [targetYear, targetMonth] = monthStr.split('-').map(Number);

    const isDateInMonth = (dateInput: string | number) => {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return false;
        return d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth;
    };

    // Filter bookings based on selected month and sport
    const filteredBookings = bookings.filter(booking => {
        const matchesSport = sportFilter === 'All' || booking.sport === sportFilter;
        if (!matchesSport) return false;
        return isDateInMonth(booking.timestamp || booking.bookingDate);
    });

    // Filter members based on start date and sport
    const filteredMembers = members.filter(member => {
        const matchesSport = sportFilter === 'All' || member.sport === sportFilter;
        if (!matchesSport) return false;
        return member.startDate && isDateInMonth(member.startDate);
    });

    // Filter students based on start date and sport
    const filteredStudents = students.filter(student => {
        const matchesSport = sportFilter === 'All' || student.sport === sportFilter;
        if (!matchesSport) return false;
        return student.startDate && isDateInMonth(student.startDate);
    });

    // Filter POS sales
    const filteredPosSales = posSales.filter(sale => isDateInMonth(sale.createdAt));

    // Filter expenses
    const filteredExpenses = expenses.filter(e => isDateInMonth(e.expenseDate));

    let totalDrinksSold = 0;
    let totalDrinkRevenue = 0;
    let totalDrinkCost = 0;
    let totalBookingRevenue = 0;
    let totalMembershipRevenue = 0;
    let totalCoachingRevenue = 0;

    // Process Bookings
    filteredBookings.forEach(booking => {
        const bookingType = booking.bookingType || BookingType.COURT;

        if (bookingType === BookingType.COURT) {
            totalBookingRevenue += Number(booking.bookingAmount) + (booking.extraHours?.enabled ? Number(booking.extraHours.amount) : 0);
        } else if (bookingType === BookingType.MEMBERSHIP) {
            totalMembershipRevenue += Number(booking.bookingAmount);
        } else if (bookingType === BookingType.COACHING) {
            totalCoachingRevenue += Number(booking.coachingFee || booking.bookingAmount || 0);
        }

        booking.selectedDrinks.forEach(drink => {
            const invItem = inventory.find(i => i.id === drink.drinkId);
            const qty = Number(drink.quantity) || 0;
            const sellPrice = Number(drink.priceAtTime);
            const purchasePrice = invItem?.purchasePrice || 0;

            totalDrinksSold += qty;
            totalDrinkRevenue += qty * sellPrice;
            totalDrinkCost += qty * purchasePrice;
        });
    });

    // Process Members table revenue
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
        totalMembershipRevenue += price;
    });

    // Process Students table revenue
    filteredStudents.forEach(student => {
        totalCoachingRevenue += Number(student.coachingFee || 0);
    });

    // Process POS Sales
    filteredPosSales.forEach(sale => {
        sale.items.forEach(item => {
            const invItem = inventory.find(i => i.id === item.drinkId);
            const qty = Number(item.quantity) || 0;
            const sellPrice = Number(item.priceAtTime);
            const purchasePrice = invItem?.purchasePrice || 0;

            totalDrinksSold += qty;
            totalDrinkRevenue += qty * sellPrice;
            totalDrinkCost += qty * purchasePrice;
        });
    });

    const courtBookingsCount = filteredBookings.filter(b => (b.bookingType || BookingType.COURT) === BookingType.COURT).length;
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalRevenue = totalDrinkRevenue + totalBookingRevenue + totalMembershipRevenue + totalCoachingRevenue;
    const totalProfit = totalRevenue - totalExpenses - totalDrinkCost;

    return {
        totalBookingRevenue,
        totalMembershipRevenue,
        totalCoachingRevenue,
        totalDrinkRevenue,
        totalDrinkCost,
        totalRevenue,
        totalExpenses,
        totalProfit,
        totalDrinksSold,
        bookingCount: courtBookingsCount
    };
};
