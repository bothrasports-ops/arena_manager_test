
// types.ts - Core types for VenueIQ
export interface BookingPlatform {
  id: string;
  name: string;
  venueId: string;
}

export type Platform = string;

export enum BookingType {
  COURT = 'Court',
  MEMBERSHIP = 'Membership',
  COACHING = 'Coaching',
}

export interface DrinkInventoryItem {
  id: string;
  name: string;
  price: number; // Selling Price
  purchasePrice: number;
  stockQuantity: number;
  imageUrl?: string;
}

export interface SelectedDrink {
  drinkId: string;
  quantity: number | '';
  priceAtTime: number;
}

export enum PaymentMethod {
  UPI = 'UPI',
  CASH = 'Cash',
  CARD = 'Card',
  ACCOUNT = 'Account',
}

export interface Booking {
  id: string;
  customerName: string;
  phoneNumber: string;
  platform: Platform;
  bookingType: BookingType;
  membershipId?: string;
  coachingFee?: number;
  bookingAmount: number;
  selectedDrinks: SelectedDrink[];
  extraHours: {
    enabled: boolean;
    duration: number; // in hours
    amount: number;
  };
  totalAmount: number;
  timestamp: number;
  bookingStartTime: string;
  bookingEndTime: string;
  bookingDate: string;
  totalHours: number;
  sport: Sport;
  courtId?: string;
  courtIds?: string[]; // Multiple selected court IDs
  paymentStatus: 'prepaid' | 'to_be_paid' | 'partially_paid';
  advancePaid: number;
  balancePaid?: number;
  paymentMethod?: PaymentMethod;
  finalPaymentMethod?: PaymentMethod;
  status: 'active' | 'completed';
}

export interface Court {
  id: string;
  name: string; // e.g., "Court 1"
  sport: Sport;
  venueId: string;
  start_time: string;
  end_time: string;
  hourly_price?: number; // Hourly charge rate for court
}

export interface AttendanceRecord {
  id: string;
  venueId: string;
  memberId?: string;
  studentId?: string;
  date: string; // YYYY-MM-DD format
  status: 'present' | 'absent';
  type: 'member' | 'student';
  created_at?: string;
}

export interface MembershipPlanDefinition {
  id: string;
  name: string;
  price: number;
  duration: 'monthly' | 'quarterly' | 'yearly';
  sport: Sport;
  description?: string;
  venueId: string;
}

export interface PosSaleItem {
  drinkId: string;
  quantity: number;
  priceAtTime: number;
}

export interface PosSale {
  id: string;
  venueId: string;
  totalAmount: number;
  items: PosSaleItem[];
  paymentMethod?: PaymentMethod;
  createdAt: string;
}

export enum Sport {
  BADMINTON = 'Badminton',
  PICKLEBALL = 'PickleBall',
  PADEL = 'Padel',
  TABLETENNIS = 'TableTennis',
  TURF = 'Turf',
}

export interface VenueProfile {
  id: string;
  admin_name: string;
  admin_email: string;
  venue_name: string;
  available_sports: Sport[];
}

export interface UserProfile extends VenueProfile {
  role: UserRole;
  venue_id?: string; // Explicit link to the venue owner
  parentId?: string; // Legacy/Additional link if needed
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  UNLINKED = 'unlinked',
}

export enum MembershipPlan {
  MONTHLY = 'Monthly',
  QUARTERLY = 'Quarterly',
  YEARLY = 'Yearly',
}

export interface MembershipSchedule {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

export interface Member {
  id: string;
  venueId: string;
  customerName: string;
  phoneNumber: string;
  plan: MembershipPlan;
  startDate: string;
  endDate: string;
  hoursPerDay: MembershipSchedule;
  status: 'active' | 'renewal_required' | 'expired';
  sport: Sport;
}

export interface Student {
  id: string;
  venueId: string;
  studentName: string;
  phoneNumber: string;
  coachingFee: number;
  startDate: string;
  endDate: string;
  schedule: MembershipSchedule;
  status: 'active' | 'expired';
  sport: Sport;
}

export interface Expense {
  id: string;
  venueId: string;
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
  paymentMethod?: PaymentMethod;
  createdAt: string;
}

export interface AppState {
  user: { id: string; email?: string; user_metadata?: Record<string, any> } | null;
  profile: UserProfile | null;
  bookings: Booking[];
  inventory: DrinkInventoryItem[];
  posSales: PosSale[];
  members: Member[];
  students: Student[];
  platforms: BookingPlatform[];
  courts: Court[];
  membershipPlans: MembershipPlanDefinition[];
  expenses: Expense[];
}
