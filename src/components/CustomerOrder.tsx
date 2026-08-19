import React, { useState, useEffect } from 'react';
import { localDB } from '../database';
import { MenuItem, Order, OrderItem, MenuItemOption } from '../types';
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle2, Clock } from 'lucide-react';

interface CustomerOrderProps {
  type: 'dinein' | 'takeout';
  tableNumber?: number;
  onOrderSubmitted?: () => void;
}

const CustomerOrder: React.FC<CustomerOrderProps> = ({ type, tableNumber, onOrderSubmitted }) => {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [restaurantName, setRestaurantName] = useState<string>('');
  
  // Cart state
  const [cart, setCart] = useState<{ menuItem: MenuItem; quantity: number; selectedOptions: MenuItemOption[] }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  
  // Order submission state
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedCode, setSubmittedCode] = useState<string>('');

  useEffect(() => {
    // Load config and menu
    setRestaurantName(localDB.getRestaurantName());
    setMenu(localDB.getMenu());
  }, []);


  const handleUpdateQuantity = (index: number, change: number) => {
    setCart(prev => prev.map((item, idx) => {
      if (idx === index) {
        const nextQty = item.quantity + change;
        return nextQty > 0 ? { ...item, quantity: nextQty } : item;
      }
      return item;
    }).filter(i => i.quantity > 0));
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Local state to keep track of checked custom options for each menu item card
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, MenuItemOption[]>>({});

  // Helper to query quantity of a specific menu item configuration in the cart
  const getCartQuantityForConfig = (itemId: string, configOptions: MenuItemOption[]) => {
    const configKey = `${itemId}_${configOptions.map(o => o.name).join('-')}`;
    const cartItem = cart.find(c => `${c.menuItem.id}_${c.selectedOptions.map(o => o.name).join('-')}` === configKey);
    return cartItem ? cartItem.quantity : 0;
  };

  // Helper to adjust quantity of a specific menu item configuration directly from the card
  const handleAdjustQuantity = (item: MenuItem, configOptions: MenuItemOption[], change: number) => {
    const configKey = `${item.id}_${configOptions.map(o => o.name).join('-')}`;
    const cartIdx = cart.findIndex(c => `${c.menuItem.id}_${c.selectedOptions.map(o => o.name).join('-')}` === configKey);
    
    if (cartIdx !== -1) {
      const newQty = cart[cartIdx].quantity + change;
      if (newQty <= 0) {
        setCart(prev => prev.filter((_, i) => i !== cartIdx));
      } else {
        setCart(prev => prev.map((c, i) => i === cartIdx ? { ...c, quantity: newQty } : c));
      }
    } else if (change > 0) {
      setCart(prev => [...prev, { menuItem: item, quantity: 1, selectedOptions: configOptions }]);
    }
  };

  // Submit order to cloud server and fallback to local DB
  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;

    // Generate random 3-digit code for takeout
    let takeoutCode = '';
    if (type === 'takeout') {
      takeoutCode = Math.floor(100 + Math.random() * 900).toString();
      setSubmittedCode(takeoutCode);
    }

    const orderItems: OrderItem[] = cart.map((c, index) => {
      return {
        id: `cust_item_${Date.now()}_${index}`,
        menuItemId: c.menuItem.id,
        name: c.menuItem.name,
        price: c.menuItem.price,
        quantity: c.quantity,
        selectedOptions: c.selectedOptions.length > 0 ? c.selectedOptions : undefined,
        served: false
      };
    });

    const totalAmount = orderItems.reduce((sum, item) => {
      const optCost = (item.selectedOptions || []).reduce((s, o) => s + o.price, 0);
      return sum + (item.price + optCost) * item.quantity;
    }, 0);

    const newOrder: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      status: 'pending',
      items: orderItems,
      totalAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (type === 'dinein') {
      newOrder.tableNumber = tableNumber;
    } else {
      newOrder.takeoutCode = takeoutCode;
    }

    // 1. Save to local storage immediately so POS running in the same browser gets it instantly
    const localOrders = localDB.getOrders();
    localDB.setOrders([...localOrders, newOrder]);

    // 2. Try POSTing to server
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newOrder),
      });
      if (!response.ok) throw new Error('API request failed');
      console.log('[CustomerOrder] Order sent to central server successfully.');
    } catch (err) {
      console.warn('[CustomerOrder] Server offline. Order queue saved locally.');
      // If server is offline, we register a CREATE_ORDER sync action in the localDB
      // so the POS client will sync this order to the main server when it goes back online!
      localDB.addToOfflineQueue({
        type: 'CREATE_ORDER',
        payload: newOrder
      });
    }

    // Reset cart and trigger UI success
    setCart([]);
    setIsSubmitted(true);
    setIsCartOpen(false);

    if (onOrderSubmitted) {
      onOrderSubmitted();
    }
  };

  const getCartTotal = () => {
    return cart.reduce((sum, c) => {
      const optCost = c.selectedOptions.reduce((s, o) => s + o.price, 0);
      return sum + (c.menuItem.price + optCost) * c.quantity;
    }, 0);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 text-center text-gray-900 select-none">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full flex flex-col items-center border border-emerald-100">
          <CheckCircle2 className="text-green-500 mb-4" size={64} />
          
          <h1 className="text-2xl font-bold text-gray-800 mb-2">點餐成功！</h1>
          
          <p className="text-sm text-gray-500 mb-6 font-medium">
            點單已傳送至 {restaurantName} 廚房
          </p>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 w-full mb-6">
            {type === 'dinein' ? (
              <div>
                <span className="text-xs text-emerald-800 font-bold block mb-1">用餐桌號</span>
                <span className="text-3xl font-extrabold text-emerald-950">第 {tableNumber} 桌</span>
                <p className="text-xs text-emerald-700/80 mt-2 font-medium">請於座位上稍候，餐點將儘快為您送上！</p>
              </div>
            ) : (
              <div>
                <span className="text-xs text-teal-800 font-bold block mb-1">外帶取餐代號</span>
                <span className="text-4xl font-mono font-extrabold text-teal-950">#{submittedCode}</span>
                <p className="text-xs text-teal-700/80 mt-3 font-medium">請憑此代號至櫃檯進行付款與取餐。</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsSubmitted(false)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition text-white font-bold rounded-xl shadow-sm text-sm"
          >
            繼續點餐
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col select-none relative">
      {/* Customer Header */}
      <header className="bg-emerald-600 text-white px-6 py-4 shadow-md sticky top-0 z-40 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold tracking-wide">🍢 {restaurantName}</h1>
          <span className="text-[10px] bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded font-bold">
            {type === 'dinein' ? `現場掃碼點餐 - 桌位 ${tableNumber}` : '現場掃碼點餐 - 外帶'}
          </span>
        </div>
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative bg-emerald-700 hover:bg-emerald-800 p-2.5 rounded-xl transition shadow active:scale-95"
        >
          <ShoppingCart size={20} />
          {cart.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-emerald-600 animate-bounce">
              {cart.reduce((sum, c) => sum + c.quantity, 0)}
            </span>
          )}
        </button>
      </header>

      {/* Menu Body */}
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full pb-24">
        <div className="space-y-4">
          {menu.map(item => {
            const hasOptions = item.options && item.options.length > 0;
            return (
              <div 
                key={item.id} 
                className={`bg-white rounded-2xl shadow-sm border p-4 flex justify-between items-center transition border-gray-100 ${
                  item.isSoldOut ? 'opacity-60 bg-gray-50' : 'hover:border-emerald-200'
                }`}
              >
                <div className="flex space-x-3.5 items-center flex-1">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-16 w-16 object-cover rounded-xl border shrink-0" />
                  ) : (
                    <div className="h-16 w-16 bg-gray-100 rounded-xl border border-dashed flex justify-center items-center text-gray-300 text-xl font-bold shrink-0">
                      🍢
                    </div>
                  )}

                  <div className="flex-1 pr-4">
                    <span className="font-extrabold text-gray-800 text-base">{item.name}</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-emerald-700 font-extrabold text-sm">${item.price}</span>
                      {item.isSoldOut && (
                        <span className="text-[10px] bg-red-100 text-red-700 font-extrabold px-1.5 py-0.5 rounded">
                          已售完
                        </span>
                      )}
                    </div>
                    {item.category && (
                      <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium mt-1 inline-block">
                        {item.category}
                      </span>
                    )}

                    {/* Rendering options under the name/price */}
                    {hasOptions && !item.isSoldOut && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {item.options?.map(opt => {
                          const currentSelected = selectedOptionsMap[item.id] || [];
                          const isSelected = currentSelected.some(o => o.name === opt.name);
                          return (
                            <button
                              key={opt.name}
                              onClick={() => {
                                const exists = currentSelected.some(o => o.name === opt.name);
                                let next;
                                if (exists) {
                                  next = currentSelected.filter(o => o.name !== opt.name);
                                } else {
                                  // Mutually exclusive: selecting one noodle type deselects the other
                                  const conflictingName = opt.name === '加王子麵' ? '加黃麵' : '加王子麵';
                                  const filtered = currentSelected.filter(o => o.name !== conflictingName);
                                  next = [...filtered, opt];
                                }
                                setSelectedOptionsMap(prev => ({ ...prev, [item.id]: next }));
                              }}
                              className={`text-[10px] px-2 py-1 rounded-lg border font-bold transition-all active:scale-95 ${
                                isSelected 
                                  ? 'bg-amber-100 border-amber-400 text-amber-800 font-extrabold shadow-sm' 
                                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {opt.name} (+${opt.price})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Add options trigger or Direct Add button */}
                <div className="shrink-0 flex flex-col space-y-1.5 items-end">
                  {!item.isSoldOut ? (
                    (() => {
                      const currentOpts = selectedOptionsMap[item.id] || [];
                      const qty = getCartQuantityForConfig(item.id, currentOpts);
                      
                      return qty === 0 ? (
                        <button
                          onClick={() => handleAdjustQuantity(item, currentOpts, 1)}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-sm active:scale-95"
                        >
                          點餐 +
                        </button>
                      ) : (
                        <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 rounded-xl p-1 shadow-sm">
                          <button
                            onClick={() => handleAdjustQuantity(item, currentOpts, -1)}
                            className="text-emerald-700 bg-white hover:bg-emerald-100 p-1 rounded transition active:scale-90"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="font-extrabold text-emerald-800 w-5 text-center text-xs">{qty}</span>
                          <button
                            onClick={() => handleAdjustQuantity(item, currentOpts, 1)}
                            className="text-emerald-700 bg-white hover:bg-emerald-100 p-1 rounded transition active:scale-90"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      );
                    })()
                  ) : (
                    <span className="bg-gray-200 text-gray-400 px-3 py-1.5 rounded-xl text-xs font-bold">
                      已售完
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-transparent z-40 max-w-2xl mx-auto w-full">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition text-white py-4 px-6 rounded-2xl shadow-xl flex justify-between items-center font-bold"
          >
            <div className="flex items-center space-x-2">
              <ShoppingCart size={20} />
              <span>點餐籃 ({cart.reduce((sum, c) => sum + c.quantity, 0)} 件)</span>
            </div>
            <span className="text-lg font-extrabold">總計: ${getCartTotal()}</span>
          </button>
        </div>
      )}

      {/* Shopping Cart Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-slide-up">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0 bg-emerald-50">
              <h2 className="font-extrabold text-gray-800 text-lg flex items-center">
                <ShoppingCart className="mr-2 text-emerald-700" size={22} />
                <span>確認您的點單</span>
              </h2>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full font-bold text-sm bg-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.map((cartItem, idx) => {
                const optCost = cartItem.selectedOptions.reduce((s, o) => s + o.price, 0);
                const singleTotal = cartItem.menuItem.price + optCost;
                const itemTotal = singleTotal * cartItem.quantity;
                const optText = cartItem.selectedOptions.map(o => o.name).join(', ');

                return (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm">
                    <div className="flex-1">
                      <span className="font-bold text-gray-800 text-base block">{cartItem.menuItem.name}</span>
                      {optText && (
                        <span className="text-xs text-amber-600 font-semibold block mt-0.5">({optText})</span>
                      )}
                      <span className="text-emerald-700 font-extrabold block mt-1.5 text-sm">${itemTotal}</span>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      {/* Quantity adjuster */}
                      <div className="flex items-center space-x-1.5 bg-white border rounded-lg p-1.5 shadow-sm">
                        <button
                          onClick={() => handleUpdateQuantity(idx, -1)}
                          className="text-gray-500 hover:text-emerald-700 p-1 hover:bg-gray-100 rounded transition"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-bold text-gray-800 w-6 text-center">{cartItem.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(idx, 1)}
                          className="text-gray-500 hover:text-emerald-700 p-1 hover:bg-gray-100 rounded transition"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => handleRemoveFromCart(idx)}
                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Drawer Footer / Submit */}
            <div className="border-t border-gray-100 p-6 space-y-4 shrink-0 bg-white shadow-inner">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-600">結帳總計</span>
                <span className="font-extrabold text-3xl text-emerald-800">${getCartTotal()}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-full py-4 border border-gray-300 hover:bg-gray-50 font-bold rounded-xl text-sm transition"
                >
                  回選單加點
                </button>
                <button
                  onClick={handleSubmitOrder}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition text-white font-bold rounded-xl shadow-md text-sm flex justify-center items-center space-x-1"
                >
                  <Clock size={16} />
                  <span>確認送出</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerOrder;
