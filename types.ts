
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

export interface AppState {
  user: { id: string; email?: string } | null;
  profile: VenueProfile | null;
  bookings: Booking[];
  inventory: DrinkInventoryItem[];
  posSales: PosSale[];
}
