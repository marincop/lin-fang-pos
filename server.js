import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow base64 images

// Default Menu Items
let menu = [
  { id: '1', name: '脆皮臭豆腐', price: 65, image: '', isSoldOut: false, category: '臭豆腐類' },
  { id: '2', name: '鹹酥臭豆腐', price: 60, image: '', isSoldOut: false, category: '臭豆腐類' },
  { id: '3', name: '麵線糊 (大)', price: 55, image: '', isSoldOut: false, category: '麵線類' },
  { id: '4', name: '麵線糊 (小)', price: 35, image: '', isSoldOut: false, category: '麵類' },
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
  { id: '12', name: '素麻醬麵 (小)', price: 45, image: '', isSoldOut: false, category: '麵類' },
  { id: '13', name: '素麻醬麵 (大)', price: 65, image: '', isSoldOut: false, category: '麵類' },
  { id: '14', name: '豆皮湯', price: 35, image: '', isSoldOut: false, category: '湯品類' },
  { id: '15', name: '泡菜', price: 30, image: '', isSoldOut: false, category: '小菜類' }
];

let restaurantName = '林坊素食臭豆腐';
let orders = []; // List of all orders (active & completed)
let systemPassword = '1234';

// Helper: generate random 3-digit code
function generateTakeoutCode() {
  let code;
  do {
    code = Math.floor(100 + Math.random() * 900).toString();
  } while (orders.some(o => o.type === 'takeout' && o.status !== 'completed' && o.takeoutCode === code));
  return code;
}

// REST API
app.get('/api/config', (req, res) => {
  res.json({ restaurantName, systemPassword });
});

app.get('/api/menu', (req, res) => {
  res.json(menu);
});

app.get('/api/orders', (req, res) => {
  res.json(orders);
});

// Post a new order from Customer/POS
app.post('/api/orders', (req, res) => {
  const orderData = req.body;
  
  // Format or generate ID/code if needed
  const newOrder = {
    ...orderData,
    id: orderData.id || 'ord_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    status: orderData.status || 'pending',
    createdAt: orderData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (newOrder.type === 'takeout' && !newOrder.takeoutCode) {
    newOrder.takeoutCode = generateTakeoutCode();
  }

  orders.push(newOrder);
  res.status(201).json(newOrder);
});

// Synchronize endpoint: handles syncing offline client actions
app.post('/api/sync', (req, res) => {
  const { clientActions, clientLastSyncTime } = req.body;
  console.log(`[Sync] Received ${clientActions?.length || 0} actions from client.`);

  if (Array.isArray(clientActions)) {
    clientActions.forEach(action => {
      const { type, payload, timestamp } = action;
      
      switch (type) {
        case 'UPDATE_RESTAURANT_NAME':
          restaurantName = payload;
          break;
        case 'UPDATE_PASSWORD':
          systemPassword = payload;
          break;
        case 'CREATE_ORDER': {
          // If order already exists, skip or merge
          const exists = orders.find(o => o.id === payload.id);
          if (!exists) {
            orders.push(payload);
          }
          break;
        }
        case 'UPDATE_ORDER_STATUS': {
          const idx = orders.findIndex(o => o.id === payload.id);
          if (idx !== -1) {
            orders[idx].status = payload.status;
            orders[idx].items = payload.items; // In case items were removed
            orders[idx].totalAmount = payload.totalAmount;
            orders[idx].updatedAt = new Date().toISOString();
          } else {
            // If it doesn't exist on server, add it
            orders.push(payload);
          }
          break;
        }
        case 'UPDATE_MENU': {
          menu = payload;
          break;
        }
        default:
          console.warn(`[Sync] Unknown action type: ${type}`);
      }
    });
  }

  res.json({
    success: true,
    menu,
    orders,
    restaurantName,
    systemPassword,
    serverTime: new Date().toISOString()
  });
});

// Serve frontend build static files
app.use(express.static(path.join(__dirname, 'dist')));

// SPA routing fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
