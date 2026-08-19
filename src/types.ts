export interface MenuItemOption {
  name: string;
  price: number;
  selected?: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  image: string; // Base64 string
  isSoldOut: boolean;
  category: string;
  options?: MenuItemOption[];
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  selectedOptions?: MenuItemOption[];
  size?: '大' | '小' | '無'; // For items with sizes
  served: boolean;
}

export type OrderStatus = 'pending' | 'cooking' | 'ready' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  type: 'dinein' | 'takeout';
  tableNumber?: number; // 1-5
  takeoutCode?: string; // 3-digit random code
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SyncAction {
  type: 'UPDATE_RESTAURANT_NAME' | 'UPDATE_PASSWORD' | 'CREATE_ORDER' | 'UPDATE_ORDER_STATUS' | 'UPDATE_MENU';
  payload: any;
  timestamp: string;
}

export interface POSConfig {
  restaurantName: string;
  systemPassword?: string;
}
