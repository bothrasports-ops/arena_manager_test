
export enum Platform {
  PLAYO = 'PlayO',
  HUDDLE = 'Huddle',
  KHELOMORE = 'KheloMore',
  OFFLINE = 'Offline',
}

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
  paymentStatus: 'prepaid' | 'to_be_paid' | 'partially_paid';
  advancePaid: number;
  status: 'active' | 'completed';
}

export interface Court {
  id: string;
  name: string; // e.g., "Court 1"
  sport: Sport;
  venueId: string;
  start_time: string;
  end_time: string;
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
}

export enum MembershipPlan {
  MONTHLY = 'Monthly',
  QUARTERLY = 'Quarterly',
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

export interface AppState {
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
  bookings: Booking[];
  inventory: DrinkInventoryItem[];
  posSales: PosSale[];
  members: Member[];
}
