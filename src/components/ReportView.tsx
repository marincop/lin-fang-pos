import React, { useState, useEffect } from 'react';
import { localDB } from '../database';
import { syncManager } from '../syncManager';
import { Order, OrderItem } from '../types';
import { DollarSign, BarChart3, Receipt, CalendarRange } from 'lucide-react';

const ReportView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [todayDate, setTodayDate] = useState<string>('');

  const loadData = () => {
    setOrders(localDB.getOrders());
  };

  useEffect(() => {
    loadData();
    setTodayDate(new Date().toLocaleDateString('zh-Hant', { year: 'numeric', month: 'long', day: 'numeric' }));

    // Real-time statistical updates
    const handleDataUpdate = () => {
      loadData();
    };
    syncManager.addDataListener(handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);

    return () => {
      syncManager.removeDataListener(handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
    };
  }, []);

  // Filter completed orders for sales computation
  const completedOrders = orders.filter(o => o.status === 'completed');
  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');

  // Today's total sales
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const pendingRevenue = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Statistics of items sold
  interface ItemSale {
    name: string;
    quantity: number;
    amount: number;
    category?: string;
  }

  const getItemSales = (): ItemSale[] => {
    const salesMap: Record<string, ItemSale> = {};

    completedOrders.forEach(order => {
      order.items.forEach((item: OrderItem) => {
        // Create unique key for items and their customizations
        const optionsText = item.selectedOptions ? ` (${item.selectedOptions.map(o => o.name).join(', ')})` : '';
        const itemKey = `${item.name}${optionsText}`;
        const itemOptionCost = (item.selectedOptions || []).reduce((s, o) => s + o.price, 0);
        const singleTotal = item.price + itemOptionCost;
        const totalCost = singleTotal * item.quantity;

        if (salesMap[itemKey]) {
          salesMap[itemKey].quantity += item.quantity;
          salesMap[itemKey].amount += totalCost;
        } else {
          salesMap[itemKey] = {
            name: item.name + optionsText,
            quantity: item.quantity,
            amount: totalCost
          };
        }
      });
    });

    return Object.values(salesMap).sort((a, b) => b.quantity - a.quantity);
  };

  const itemSales = getItemSales();

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-md p-6 overflow-hidden">
      {/* Report Header */}
      <div className="flex justify-between items-center border-b pb-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center text-emerald-800">
            <BarChart3 className="mr-2" size={24} />
            <span>今日營業額與銷售統計</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1 flex items-center">
            <CalendarRange size={14} className="mr-1" />
            營業日期：{todayDate}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold">
            結帳報表
          </span>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-6 shrink-0 text-sm">
        {/* Total revenue Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-emerald-800/80 font-bold block mb-1">今日已收金額 (總營業額)</span>
            <span className="text-3xl font-extrabold text-emerald-900">${totalRevenue}</span>
          </div>
          <div className="bg-emerald-600 text-white p-3 rounded-2xl shadow-sm">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Pending revenue Card */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 border border-yellow-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-yellow-800/80 font-bold block mb-1">待結帳金額 (進行中訂單)</span>
            <span className="text-3xl font-extrabold text-yellow-900">${pendingRevenue}</span>
          </div>
          <div className="bg-yellow-600 text-white p-3 rounded-2xl shadow-sm">
            <Receipt size={24} />
          </div>
        </div>

        {/* Order count Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-blue-800/80 font-bold block mb-1">已結帳訂單數</span>
            <span className="text-3xl font-extrabold text-blue-900">{completedOrders.length} 筆</span>
          </div>
          <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-sm">
            <Receipt size={24} />
          </div>
        </div>
      </div>

      {/* Main Stats Split Layout */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Left Side: Dish Sales Portions Breakdown */}
        <div className="flex-1 border border-gray-100 bg-gray-50/50 rounded-2xl p-5 flex flex-col overflow-hidden">
          <h3 className="text-base font-bold text-gray-700 mb-3 shrink-0 flex items-center">
            <span>🍢 單品銷售統計列表</span>
          </h3>

          <div className="flex-1 overflow-y-auto pr-1">
            {itemSales.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm py-20">
                今日尚無銷售紀錄
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse bg-white rounded-xl overflow-hidden shadow-sm">
                <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 text-xs">
                  <tr>
                    <th className="px-4 py-3.5">菜品名稱</th>
                    <th className="px-4 py-3.5 text-center">售出份數</th>
                    <th className="px-4 py-3.5 text-right">銷售總額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                  {itemSales.map((sale, index) => (
                    <tr key={index} className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-3.5 font-bold text-gray-800">{sale.name}</td>
                      <td className="px-4 py-3.5 text-center text-emerald-800 font-extrabold">
                        {sale.quantity} 份
                      </td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-gray-900">
                        ${sale.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side: Completed Transactions Log */}
        <div className="w-96 border border-gray-100 bg-gray-50/50 rounded-2xl p-5 flex flex-col overflow-hidden">
          <h3 className="text-base font-bold text-gray-700 mb-3 shrink-0">
            📋 已結帳交易明細
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {completedOrders.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm py-20">
                今日尚無已結帳訂單
              </div>
            ) : (
              completedOrders
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .map(order => (
                  <div key={order.id} className="bg-white p-3.5 border border-gray-100 rounded-xl shadow-sm text-xs">
                    <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-gray-50">
                      <span className="font-extrabold text-gray-800">
                        {order.type === 'dinein' ? `內用 - 桌號 ${order.tableNumber}` : `外帶 - #${order.takeoutCode}`}
                      </span>
                      <span className="font-mono text-gray-400">
                        {new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-gray-600 font-medium">
                      {order.items.map((item, idx) => {
                        const optText = item.selectedOptions?.map(o => o.name).join(', ');
                        return (
                          <div key={idx} className="flex justify-between items-center">
                            <span>
                              {item.name} {optText ? `(${optText})` : ''} x {item.quantity}
                            </span>
                            <span>
                              ${(item.price + (item.selectedOptions?.reduce((s, o) => s + o.price, 0) || 0)) * item.quantity}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-dashed border-gray-100 text-sm">
                      <span className="font-bold text-gray-500">交易金額</span>
                      <span className="font-extrabold text-emerald-800">${order.totalAmount}</span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportView;
