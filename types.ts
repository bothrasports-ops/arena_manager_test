
export enum Platform {
  PLAYO = 'PlayO',
  HUDDLE = 'Huddle',
  KHELOMORE = 'KheloMore',
  OFFLINE = 'Offline',
}

export interface DrinkInventoryItem {
  id: string;
  name: string;
  price: number;
}

export interface SelectedDrink {
  drinkId: string;
  quantity: number;
  priceAtTime: number;
}

export interface Booking {
  id: string;
  customerName: string;
  phoneNumber: string;
  platform: Platform;
  bookingAmount: number;
  selectedDrinks: SelectedDrink[];
  extraHours: {
    enabled: boolean;
    duration: number; // in hours
    amount: number;
  };
  totalAmount: number;
  timestamp: number;
}

export interface AppState {
  user: { name: string } | null;
  bookings: Booking[];
  inventory: DrinkInventoryItem[];
}
