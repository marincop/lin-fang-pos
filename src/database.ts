import { MenuItem, Order, SyncAction } from './types';

// Default menu items as defined in requirements
const DEFAULT_MENU: MenuItem[] = [
  { id: '1', name: '脆皮臭豆腐', price: 65, image: '', isSoldOut: false, category: '臭豆腐類' },
  { id: '2', name: '鹹酥臭豆腐', price: 60, image: '', isSoldOut: false, category: '臭豆腐類' },
  { id: '3', name: '麵線糊 (大)', price: 55, image: '', isSoldOut: false, category: '主食類' },
  { id: '4', name: '麵線糊 (小)', price: 35, image: '', isSoldOut: false, category: '主食類' },
  { id: '5', name: '洛神花茶', price: 40, image: '', isSoldOut: false, category: '飲料類' },
  { id: '6', name: '自製辣椒醬', price: 160, image: '', isSoldOut: false, category: '伴手禮' },
  { id: '7', name: '自製泡菜', price: 80, image: '', isSoldOut: false, category: '小菜類' },
  { id: '8', name: '臭薯條 (大)', price: 60, image: '', isSoldOut: false, category: '創意點心' },
  { id: '9', name: '臭薯條 (小)', price: 40, image: '', isSoldOut: false, category: '創意點心' },
  { id: '10', name: '炸杏鮑菇', price: 50, image: '', isSoldOut: false, category: '炸物類' },
  { id: '11', name: '臭臭鍋', price: 65, image: '', isSoldOut: false, category: '鍋物類', options: [
    { name: '加王子麵', price: 15, selected: false },
    { name: '加黃麵', price: 20, selected: false }
  ] },
  { id: '12', name: '素麻醬麵 (小)', price: 45, image: '', isSoldOut: false, category: '主食類' },
  { id: '13', name: '素麻醬麵 (大)', price: 65, image: '', isSoldOut: false, category: '主食類' },
  { id: '14', name: '豆皮湯', price: 35, image: '', isSoldOut: false, category: '湯品類' },
  { id: '15', name: '泡菜', price: 30, image: '', isSoldOut: false, category: '小菜類' }
];

const DEFAULT_RESTAURANT_NAME = '林坊素食臭豆腐';
const DEFAULT_PASSWORD = '1234';

// Helper keys for localStorage
const KEYS = {
  MENU: 'lf_pos_menu',
  ORDERS: 'lf_pos_orders',
  RESTAURANT_NAME: 'lf_pos_restaurant_name',
  PASSWORD: 'lf_pos_password',
  OFFLINE_QUEUE: 'lf_pos_offline_queue',
  LAST_SYNC: 'lf_pos_last_sync'
};

export const localDB = {
  getMenu(): MenuItem[] {
    const data = localStorage.getItem(KEYS.MENU);
    if (!data) {
      this.setMenu(DEFAULT_MENU);
      return DEFAULT_MENU;
    }
    return JSON.parse(data);
  },

  setMenu(menu: MenuItem[]) {
    localStorage.setItem(KEYS.MENU, JSON.stringify(menu));
  },

  getOrders(): Order[] {
    const data = localStorage.getItem(KEYS.ORDERS);
    return data ? JSON.parse(data) : [];
  },

  setOrders(orders: Order[]) {
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  },

  getRestaurantName(): string {
    const name = localStorage.getItem(KEYS.RESTAURANT_NAME);
    if (!name) {
      this.setRestaurantName(DEFAULT_RESTAURANT_NAME);
      return DEFAULT_RESTAURANT_NAME;
    }
    return name;
  },

  setRestaurantName(name: string) {
    localStorage.setItem(KEYS.RESTAURANT_NAME, name);
  },

  getPassword(): string {
    const pwd = localStorage.getItem(KEYS.PASSWORD);
    if (!pwd) {
      this.setPassword(DEFAULT_PASSWORD);
      return DEFAULT_PASSWORD;
    }
    return pwd;
  },

  setPassword(pwd: string) {
    localStorage.setItem(KEYS.PASSWORD, pwd);
  },

  getOfflineQueue(): SyncAction[] {
    const data = localStorage.getItem(KEYS.OFFLINE_QUEUE);
    return data ? JSON.parse(data) : [];
  },

  setOfflineQueue(queue: SyncAction[]) {
    localStorage.setItem(KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  },

  addToOfflineQueue(action: Omit<SyncAction, 'timestamp'>) {
    const queue = this.getOfflineQueue();
    const newAction: SyncAction = {
      ...action,
      timestamp: new Date().toISOString()
    };
    queue.push(newAction);
    this.setOfflineQueue(queue);
  },

  clearOfflineQueue() {
    this.setOfflineQueue([]);
  },

  getLastSync(): string | null {
    return localStorage.getItem(KEYS.LAST_SYNC);
  },

  setLastSync(timestamp: string) {
    localStorage.setItem(KEYS.LAST_SYNC, timestamp);
  },

  // Full reset to default (for demo/testing helper)
  resetToDefault() {
    this.setMenu(DEFAULT_MENU);
    this.setRestaurantName(DEFAULT_RESTAURANT_NAME);
    this.setPassword(DEFAULT_PASSWORD);
    this.setOrders([]);
    this.clearOfflineQueue();
    localStorage.removeItem(KEYS.LAST_SYNC);
  }
};
