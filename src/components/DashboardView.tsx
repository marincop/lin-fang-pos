import React, { useState, useEffect } from 'react';
import { localDB } from '../database';
import { syncManager } from '../syncManager';
import { Order, OrderItem, MenuItem, OrderStatus, MenuItemOption } from '../types';
import { Play, Check, Trash2, Plus, X, Users, ShoppingBag } from 'lucide-react';

interface DashboardViewProps {
  onDataChanged: () => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ onDataChanged }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  
  // Ordering Modal state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [modalOrderType, setModalOrderType] = useState<'dinein' | 'takeout'>('dinein');
  const [modalTableNumber, setModalTableNumber] = useState<number>(1);
  const [cart, setCart] = useState<{ menuItem: MenuItem; quantity: number; selectedSize?: '大' | '小' | '無'; selectedOptions: MenuItemOption[] }[]>([]);

  useEffect(() => {
    loadData();

    // Automatically reload orders when data updates from network sync
    const handleDataUpdate = () => {
      loadData();
    };
    syncManager.addDataListener(handleDataUpdate);

    // Automatically reload orders when order is placed from a different tab (same device)
    window.addEventListener('storage', handleDataUpdate);

    return () => {
      syncManager.removeDataListener(handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
    };
  }, []);

  const loadData = () => {
    setOrders(localDB.getOrders());
    setMenu(localDB.getMenu());
  };

  // Keep state updated on manual change
  const saveOrders = (updatedOrders: Order[]) => {
    setOrders(updatedOrders);
    localDB.setOrders(updatedOrders);
    syncManager.triggerDataChange(); // Notify other views
    onDataChanged();
  };

  // Generate 3-digit takeout code
  const generateTakeoutCode = () => {
    let code: string;
    do {
      code = Math.floor(100 + Math.random() * 900).toString();
    } while (orders.some(o => o.type === 'takeout' && o.status !== 'completed' && o.status !== 'cancelled' && o.takeoutCode === code));
    return code;
  };

  // Mark all items as served
  const handleServeAll = (orderId: string) => {
    const updated = orders.map(order => {
      if (order.id === orderId) {
        const updatedItems = order.items.map(item => ({ ...item, served: true }));
        const updatedOrder: Order = {
          ...order,
          items: updatedItems,
          status: 'ready' as OrderStatus,
          updatedAt: new Date().toISOString()
        };
        // Add to offline sync queue
        localDB.addToOfflineQueue({
          type: 'UPDATE_ORDER_STATUS',
          payload: updatedOrder
        });
        return updatedOrder;
      }
      return order;
    });
    saveOrders(updated);
  };

  // Toggle single item served status
  const handleToggleItemServed = (orderId: string, itemId: string) => {
    const updated = orders.map(order => {
      if (order.id === orderId) {
        const updatedItems = order.items.map(item => {
          if (item.id === itemId) {
            return { ...item, served: !item.served };
          }
          return item;
        });
        
        // If all items are served, mark status as 'ready' (cooked), otherwise 'cooking'
        const allServed = updatedItems.every(i => i.served);
        const nextStatus: OrderStatus = allServed ? 'ready' : 'cooking';

        const updatedOrder: Order = {
          ...order,
          items: updatedItems,
          status: nextStatus,
          updatedAt: new Date().toISOString()
        };

        localDB.addToOfflineQueue({
          type: 'UPDATE_ORDER_STATUS',
          payload: updatedOrder
        });
        return updatedOrder;
      }
      return order;
    });
    saveOrders(updated);
  };

  // Delete a specific item from an order (e.g. sold out)
  const handleDeleteItem = (orderId: string, itemId: string) => {
    const updated = orders.map(order => {
      if (order.id === orderId) {
        const updatedItems = order.items.filter(item => item.id !== itemId);
        
        // Recalculate total amount
        const newTotal = updatedItems.reduce((sum, item) => {
          const optionsCost = (item.selectedOptions || []).reduce((s, opt) => s + opt.price, 0);
          return sum + (item.price + optionsCost) * item.quantity;
        }, 0);

        // If no items left, cancel the order, otherwise update
        const nextStatus: OrderStatus = updatedItems.length === 0 ? 'cancelled' : order.status;

        const updatedOrder: Order = {
          ...order,
          items: updatedItems,
          totalAmount: newTotal,
          status: nextStatus,
          updatedAt: new Date().toISOString()
        };

        localDB.addToOfflineQueue({
          type: 'UPDATE_ORDER_STATUS',
          payload: updatedOrder
        });
        return updatedOrder;
      }
      return order;
    });
    saveOrders(updated);
  };

  // Check out (Complete order)
  const handleCheckout = (orderId: string) => {
    const updated = orders.map(order => {
      if (order.id === orderId) {
        const updatedOrder: Order = {
          ...order,
          status: 'completed' as OrderStatus,
          updatedAt: new Date().toISOString()
        };

        localDB.addToOfflineQueue({
          type: 'UPDATE_ORDER_STATUS',
          payload: updatedOrder
        });
        return updatedOrder;
      }
      return order;
    });
    saveOrders(updated);
  };

  // Manual Ordering Logic
  const handleOpenOrderModal = (type: 'dinein' | 'takeout', tableNum?: number) => {
    setModalOrderType(type);
    if (tableNum) setModalTableNumber(tableNum);
    setCart([]);
    setIsOrderModalOpen(true);
  };

  const handleAddToCart = (item: MenuItem, size?: '大' | '小' | '無', options: MenuItemOption[] = []) => {
    // The items with sizes in DEFAULT_MENU already have separate prices (e.g. 麵線糊 (大) is 55, 麵線糊 (小) is 35)
    // If selecting size from options, we update name/price if needed.
    
    const cartItemId = `${item.id}_${size || 'default'}_${options.map(o => o.name).join('-')}`;
    
    setCart(prev => {
      const existing = prev.find(i => `${i.menuItem.id}_${i.selectedSize || 'default'}_${i.selectedOptions.map(o => o.name).join('-')}` === cartItemId);
      if (existing) {
        return prev.map(i => 
          `${i.menuItem.id}_${i.selectedSize || 'default'}_${i.selectedOptions.map(o => o.name).join('-')}` === cartItemId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      } else {
        return [...prev, { menuItem: item, quantity: 1, selectedSize: size, selectedOptions: options }];
      }
    });
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitManualOrder = () => {
    if (cart.length === 0) return;

    const orderItems: OrderItem[] = cart.map((c, index) => {
      return {
        id: `ord_item_${Date.now()}_${index}`,
        menuItemId: c.menuItem.id,
        name: c.menuItem.name,
        price: c.menuItem.price,
        quantity: c.quantity,
        selectedOptions: c.selectedOptions.length > 0 ? c.selectedOptions : undefined,
        size: c.selectedSize || '無',
        served: false
      };
    });

    const totalAmount = orderItems.reduce((sum, item) => {
      const optCost = (item.selectedOptions || []).reduce((s, o) => s + o.price, 0);
      return sum + (item.price + optCost) * item.quantity;
    }, 0);

    const isDinein = modalOrderType === 'dinein';
    
    // Create new order object
    const newOrder: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: modalOrderType,
      status: 'pending',
      items: orderItems,
      totalAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isDinein) {
      newOrder.tableNumber = modalTableNumber;
      
      // If table already has an active order, merge or cancel first. Let's block new orders if table is active.
      const hasActive = orders.some(o => o.type === 'dinein' && o.tableNumber === modalTableNumber && o.status !== 'completed' && o.status !== 'cancelled');
      if (hasActive) {
        alert(`桌號 ${modalTableNumber} 目前已有進行中的訂單，請先結帳！`);
        return;
      }
    } else {
      newOrder.takeoutCode = generateTakeoutCode();
    }

    // Add to offline sync queue
    localDB.addToOfflineQueue({
      type: 'CREATE_ORDER',
      payload: newOrder
    });

    saveOrders([...orders, newOrder]);
    setIsOrderModalOpen(false);
  };

  // Get active order for table (1-5)
  const getTableOrder = (tableNum: number): Order | undefined => {
    return orders.find(o => o.type === 'dinein' && o.tableNumber === tableNum && o.status !== 'completed' && o.status !== 'cancelled');
  };

  // Get active takeout orders
  const getActiveTakeouts = (): Order[] => {
    return orders.filter(o => o.type === 'takeout' && o.status !== 'completed' && o.status !== 'cancelled')
                 .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  return (
    <div className="flex h-full gap-6 overflow-hidden">
      {/* LEFT SECTION: Dine-in (内用餐) */}
      <section className="flex-1 flex flex-col bg-white rounded-xl shadow-md p-5 overflow-hidden">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-xl font-bold flex items-center text-emerald-800">
            <Users className="mr-2" size={24} />
            <span>內用餐區 (1 ~ 5 桌)</span>
          </h2>
          <span className="text-sm bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-semibold">
            今日桌況
          </span>
        </div>

        {/* 5 Tables Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 overflow-y-auto pr-1">
          {[1, 2, 3, 4, 5].map(tableNum => {
            const tableOrder = getTableOrder(tableNum);
            
            return (
              <div 
                key={tableNum} 
                className={`border rounded-2xl flex flex-col overflow-hidden transition-all shadow-sm ${
                  tableOrder 
                    ? tableOrder.status === 'ready' 
                      ? 'border-green-500 bg-green-50/30' 
                      : 'border-yellow-500 bg-yellow-50/20' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Table Header */}
                <div className={`px-4 py-3 border-b flex justify-between items-center ${
                  tableOrder 
                    ? tableOrder.status === 'ready'
                      ? 'bg-green-600 text-white'
                      : 'bg-yellow-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  <span className="font-extrabold text-lg">桌號 {tableNum}</span>
                  {tableOrder ? (
                    <span className="text-xs px-2 py-0.5 bg-white/20 rounded font-semibold">
                      {tableOrder.status === 'ready' ? '出餐完成' : '出餐中'}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 font-semibold">空桌</span>
                  )}
                </div>

                {/* Table Content */}
                <div className="flex-1 p-4 flex flex-col justify-between min-h-[220px]">
                  {tableOrder ? (
                    <>
                      {/* Dishes List */}
                      <div className="space-y-2 flex-1 max-h-[180px] overflow-y-auto pr-1 text-sm">
                        {tableOrder.items.map(item => {
                          const optionsText = item.selectedOptions?.map(o => o.name).join(', ');
                          return (
                            <div key={item.id} className="flex justify-between items-start border-b border-gray-100 pb-1.5">
                              <div className="flex-1">
                                <div className="flex items-center space-x-1.5">
                                  {/* Checkbox to serve individual item */}
                                  <input 
                                    type="checkbox" 
                                    checked={item.served}
                                    onChange={() => handleToggleItemServed(tableOrder.id, item.id)}
                                    className="h-4.5 w-4.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    title="出菜切換"
                                  />
                                  <span className={`font-semibold ${item.served ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                    {item.name} x {item.quantity}
                                  </span>
                                </div>
                                {optionsText && (
                                  <span className="text-xs text-amber-600 font-medium block ml-6">({optionsText})</span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 text-right">
                                <span className={`font-medium ${item.served ? 'text-gray-400' : 'text-gray-700'}`}>
                                  ${(item.price + (item.selectedOptions?.reduce((s, o) => s + o.price, 0) || 0)) * item.quantity}
                                </span>
                                <button 
                                  onClick={() => handleDeleteItem(tableOrder.id, item.id)}
                                  className="text-red-500 hover:text-red-700 p-0.5 active:scale-90 transition"
                                  title="刪除品項"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total Amount & Actions */}
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-gray-500 font-medium text-xs">下單時間: {new Date(tableOrder.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          <span className="font-extrabold text-emerald-800 text-lg">合計: ${tableOrder.totalAmount}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleServeAll(tableOrder.id)}
                            disabled={tableOrder.status === 'ready'}
                            className={`flex justify-center items-center space-x-1 py-2 rounded-xl text-sm font-bold shadow-sm transition active:scale-95 ${
                              tableOrder.status === 'ready'
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            <Play size={14} />
                            <span>出菜</span>
                          </button>
                          <button
                            onClick={() => handleCheckout(tableOrder.id)}
                            className="flex justify-center items-center space-x-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold shadow-sm transition active:scale-95"
                          >
                            <Check size={14} />
                            <span>結帳</span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 p-4">
                      <span className="text-gray-400 text-sm mb-3">尚無點餐資料</span>
                      <button
                        onClick={() => handleOpenOrderModal('dinein', tableNum)}
                        className="flex items-center space-x-1 bg-white hover:bg-gray-100 text-emerald-700 border border-emerald-600 rounded-lg px-3 py-1.5 text-xs font-bold transition active:scale-95"
                      >
                        <Plus size={14} />
                        <span>手動點餐</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* RIGHT SECTION: Takeout (外帶) */}
      <section className="w-80 md:w-96 flex flex-col bg-white rounded-xl shadow-md p-5 overflow-hidden shrink-0">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-xl font-bold flex items-center text-teal-800">
            <ShoppingBag className="mr-2" size={24} />
            <span>外帶訂單明細</span>
          </h2>
          <button
            onClick={() => handleOpenOrderModal('takeout')}
            className="flex items-center space-x-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-2.5 py-1 text-xs font-bold transition active:scale-95 shadow-sm"
          >
            <Plus size={14} />
            <span>手動外帶</span>
          </button>
        </div>

        {/* Takeout active orders list */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {getActiveTakeouts().length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 py-16">
              <ShoppingBag className="text-gray-300 mb-2" size={40} />
              <span className="text-gray-400 text-sm">目前無外帶訂單</span>
            </div>
          ) : (
            getActiveTakeouts().map(order => (
              <div 
                key={order.id} 
                className={`border rounded-2xl overflow-hidden transition-all shadow-sm ${
                  order.status === 'ready' 
                    ? 'border-green-500 bg-green-50/30' 
                    : 'border-teal-500 bg-teal-50/20'
                }`}
              >
                {/* Takeout Header */}
                <div className={`px-4 py-2.5 flex justify-between items-center ${
                  order.status === 'ready'
                    ? 'bg-green-600 text-white'
                    : 'bg-teal-600 text-white'
                }`}>
                  <span className="font-extrabold text-base tracking-wide">外帶代號: #{order.takeoutCode}</span>
                  <span className="text-xs px-2 py-0.5 bg-white/20 rounded font-semibold">
                    {order.status === 'ready' ? '完成/待取' : '準備中'}
                  </span>
                </div>

                {/* Takeout Content */}
                <div className="p-4 flex flex-col justify-between">
                  {/* Order items */}
                  <div className="space-y-2 text-sm max-h-[140px] overflow-y-auto pr-1">
                    {order.items.map(item => {
                      const optionsText = item.selectedOptions?.map(o => o.name).join(', ');
                      return (
                        <div key={item.id} className="flex justify-between items-start border-b border-gray-50 pb-1.5">
                          <div className="flex-1">
                            <div className="flex items-center space-x-1.5">
                              <input 
                                type="checkbox" 
                                checked={item.served}
                                onChange={() => handleToggleItemServed(order.id, item.id)}
                                className="h-4.5 w-4.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                title="出餐切換"
                              />
                              <span className={`font-semibold ${item.served ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                {item.name} x {item.quantity}
                              </span>
                            </div>
                            {optionsText && (
                              <span className="text-xs text-amber-600 font-medium block ml-6">({optionsText})</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-right">
                            <span className={`font-medium ${item.served ? 'text-gray-400' : 'text-gray-700'}`}>
                              ${(item.price + (item.selectedOptions?.reduce((s, o) => s + o.price, 0) || 0)) * item.quantity}
                            </span>
                            <button 
                              onClick={() => handleDeleteItem(order.id, item.id)}
                              className="text-red-500 hover:text-red-700 p-0.5 active:scale-90 transition"
                              title="刪除品項"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary & Buttons */}
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-500 font-medium text-xs">下單: {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      <span className="font-extrabold text-teal-800 text-base">合計: ${order.totalAmount}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleServeAll(order.id)}
                        disabled={order.status === 'ready'}
                        className={`flex justify-center items-center space-x-1 py-1.5 rounded-xl text-xs font-bold shadow-sm transition active:scale-95 ${
                          order.status === 'ready'
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-teal-600 hover:bg-teal-700 text-white'
                        }`}
                      >
                        <Play size={12} />
                        <span>出餐完成</span>
                      </button>
                      <button
                        onClick={() => handleCheckout(order.id)}
                        className="flex justify-center items-center space-x-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
                      >
                        <Check size={12} />
                        <span>結帳</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Manual Ordering Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-emerald-700 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold">
                  {modalOrderType === 'dinein' ? `手動新增 - 內用餐點 (桌號 ${modalTableNumber})` : '手動新增 - 外帶餐點'}
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">請選取菜品及客製化選項後送出</p>
              </div>
              <button 
                onClick={() => setIsOrderModalOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Menu selection */}
              <div className="w-2/3 p-6 overflow-y-auto border-r border-gray-100">
                <h4 className="font-bold text-gray-700 mb-4 border-b border-gray-200 pb-2 text-sm">選擇菜色</h4>
                <div className="grid grid-cols-2 gap-4">
                  {menu.map(item => {
                    const hasOptions = item.options && item.options.length > 0;
                    return (
                      <div 
                        key={item.id} 
                        className={`border rounded-xl p-3 flex flex-col justify-between hover:shadow transition-all relative ${
                          item.isSoldOut ? 'bg-gray-100 opacity-60 border-gray-200' : 'bg-white border-gray-200 hover:border-emerald-500'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-gray-800 text-base">{item.name}</span>
                            <span className="text-emerald-700 font-extrabold">${item.price}</span>
                          </div>
                          {item.category && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium mt-1 inline-block">
                              {item.category}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 flex flex-col space-y-2">
                          {/* Render custom options directly if present (e.g. 加王子麵) */}
                          {hasOptions && (
                            <div className="space-y-1.5 bg-amber-50/50 p-2 rounded border border-amber-100">
                              <span className="text-xs font-bold text-amber-800 block">客製選項:</span>
                              {item.options?.map(opt => (
                                <button
                                  key={opt.name}
                                  onClick={() => {
                                    if (item.isSoldOut) return;
                                    // Toggle option directly for ordering
                                    handleAddToCart(item, '無', [opt]);
                                  }}
                                  className="w-full text-left text-xs bg-white hover:bg-amber-100 border border-amber-200 text-amber-800 py-1 px-2 rounded flex justify-between font-semibold"
                                >
                                  <span>{opt.name}</span>
                                  <span>+${opt.price}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          <button
                            disabled={item.isSoldOut}
                            onClick={() => handleAddToCart(item, '無', [])}
                            className={`w-full py-1.5 rounded-lg text-xs font-extrabold transition active:scale-95 shadow-sm ${
                              item.isSoldOut 
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {item.isSoldOut ? '已售完' : '加入點單'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Cart summary */}
              <div className="w-1/3 p-6 bg-gray-50 flex flex-col justify-between overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden">
                  <h4 className="font-bold text-gray-700 mb-4 border-b border-gray-200 pb-2 text-sm flex justify-between items-center">
                    <span>點單明細</span>
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-bold">
                      {cart.reduce((sum, c) => sum + c.quantity, 0)} 件
                    </span>
                  </h4>

                  {/* Cart Item List */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-sm">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs py-20">
                        <span>尚未選取任何菜色</span>
                      </div>
                    ) : (
                      cart.map((cartItem, idx) => {
                        const optCost = cartItem.selectedOptions.reduce((s, o) => s + o.price, 0);
                        const singleTotal = cartItem.menuItem.price + optCost;
                        const itemTotal = singleTotal * cartItem.quantity;
                        const optText = cartItem.selectedOptions.map(o => o.name).join(', ');

                        return (
                          <div key={idx} className="flex justify-between items-start bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex-1 pr-2">
                              <span className="font-bold text-gray-800 block">{cartItem.menuItem.name}</span>
                              {optText && <span className="text-[10px] text-amber-600 font-medium block">({optText})</span>}
                              <span className="text-xs text-gray-500 font-mono block mt-0.5">
                                ${singleTotal} x {cartItem.quantity}
                              </span>
                            </div>
                            <div className="text-right flex items-center space-x-2">
                              <span className="font-extrabold text-emerald-800">${itemTotal}</span>
                              <button
                                onClick={() => handleRemoveFromCart(idx)}
                                className="text-red-500 hover:text-red-700 p-0.5 transition"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Cart Total & Submit */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-gray-600">總金額</span>
                    <span className="font-extrabold text-2xl text-emerald-800">
                      ${cart.reduce((sum, c) => {
                        const optCost = c.selectedOptions.reduce((s, o) => s + o.price, 0);
                        return sum + (c.menuItem.price + optCost) * c.quantity;
                      }, 0)}
                    </span>
                  </div>

                  <button
                    disabled={cart.length === 0}
                    onClick={handleSubmitManualOrder}
                    className={`w-full py-3.5 rounded-xl font-bold shadow-md transition-all active:scale-95 flex justify-center items-center ${
                      cart.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <span>送出訂單</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;
