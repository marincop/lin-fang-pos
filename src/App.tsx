import { useState, useEffect } from 'react';
import { localDB } from './database';
import { syncManager } from './syncManager';
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import MenuManager from './components/MenuManager';
import ReportView from './components/ReportView';
import CustomerOrder from './components/CustomerOrder';
import { Wifi, WifiOff, LogOut, ClipboardList, Settings, TrendingUp } from 'lucide-react';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'report'>('orders');
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isForceOffline, setIsForceOffline] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>('已同步');

  // Customer order routing check
  const urlParams = new URLSearchParams(window.location.search);
  const customerOrderType = urlParams.get('type') as 'dinein' | 'takeout' | null;
  const customerTable = urlParams.get('table') ? parseInt(urlParams.get('table')!, 10) : undefined;

  useEffect(() => {
    // Initialize DB name
    setRestaurantName(localDB.getRestaurantName());
    setIsForceOffline(syncManager.getForceOffline());

    // Listen to network status changes
    const handleNetworkChange = (online: boolean) => {
      setIsOnline(online);
    };
    syncManager.addNetworkListener(handleNetworkChange);

    // Start auto sync (check every 10 seconds)
    syncManager.startAutoSync(10000);

    // Listen for storage changes from other tabs (like customer ordering on the same machine)
    const handleStorageChange = () => {
      setRestaurantName(localDB.getRestaurantName());
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      syncManager.removeNetworkListener(handleNetworkChange);
      syncManager.stopAutoSync();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleForceOfflineToggle = () => {
    const nextState = !isForceOffline;
    setIsForceOffline(nextState);
    syncManager.setForceOffline(nextState);
  };

  const handleManualSync = async () => {
    setSyncStatus('同步中...');
    const res = await syncManager.syncWithServer();
    if (res.success) {
      setSyncStatus('同步成功');
      setRestaurantName(localDB.getRestaurantName());
      setTimeout(() => setSyncStatus('已同步'), 3000);
    } else {
      setSyncStatus(`同步失敗: ${res.error || '離線'}`);
      setTimeout(() => setSyncStatus(syncManager.isOnline() ? '已同步' : '離線中'), 3000);
    }
  };

  // If customer scans QR Code, display customer ordering screen
  if (customerOrderType === 'dinein' || customerOrderType === 'takeout') {
    return (
      <CustomerOrder 
        type={customerOrderType} 
        tableNumber={customerTable} 
        onOrderSubmitted={() => {
          // Trigger manual sync or notify POS tab if running locally
          handleManualSync();
        }}
      />
    );
  }

  // Admin POS login flow
  if (!isLoggedIn) {
    return (
      <LoginView 
        onLoginSuccess={() => {
          setIsLoggedIn(true);
          setRestaurantName(localDB.getRestaurantName());
        }} 
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 select-none">
      {/* Header bar */}
      <header className="bg-emerald-700 text-white shadow-md px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-3">
          <span className="text-2xl font-bold tracking-wider">🍢 {restaurantName}</span>
          <span className="bg-emerald-800 text-emerald-100 text-xs px-2.5 py-0.5 rounded font-semibold">POS系統</span>
        </div>

        {/* Sync Controls & Network Status */}
        <div className="flex items-center space-x-4">
          {/* Force Offline Simulator Toggle */}
          <button
            onClick={handleForceOfflineToggle}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-sm transition-colors font-medium border ${
              isForceOffline 
                ? 'bg-red-600 text-white border-red-500 hover:bg-red-500' 
                : 'bg-emerald-800 text-emerald-100 border-emerald-600 hover:bg-emerald-900'
            }`}
            title="點擊模擬切換網路斷線狀態"
          >
            {isForceOffline ? <WifiOff size={16} /> : <Wifi size={16} />}
            <span>{isForceOffline ? '模擬離線' : '模擬在線'}</span>
          </button>

          {/* Actual Network Icon */}
          <div className="flex items-center space-x-1">
            {isOnline ? (
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500"></span>
              </span>
            ) : (
              <span className="inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
            )}
            <span className="text-sm font-medium">{isOnline ? '主系統連線中' : '無網路/離線'}</span>
          </div>

          <button 
            onClick={handleManualSync}
            className="text-xs bg-emerald-800 hover:bg-emerald-900 active:scale-95 transition px-2.5 py-1 rounded font-mono"
          >
            {syncStatus}
          </button>

          <button
            onClick={() => setIsLoggedIn(false)}
            className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 active:scale-95 transition px-3 py-1.5 rounded text-sm font-semibold shadow"
          >
            <LogOut size={16} />
            <span>登出</span>
          </button>
        </div>
      </header>

      {/* Tabs navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm flex justify-center space-x-8 shrink-0">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center space-x-2 py-4 px-6 border-b-4 font-bold text-lg transition-all ${
            activeTab === 'orders'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClipboardList size={22} />
          <span>大廚出餐與結帳</span>
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex items-center space-x-2 py-4 px-6 border-b-4 font-bold text-lg transition-all ${
            activeTab === 'menu'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings size={22} />
          <span>菜單與設定</span>
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`flex items-center space-x-2 py-4 px-6 border-b-4 font-bold text-lg transition-all ${
            activeTab === 'report'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp size={22} />
          <span>今日營業額</span>
        </button>
      </nav>

      {/* Sub-view Area */}
      <main className="flex-1 overflow-hidden p-6">
        {activeTab === 'orders' && <DashboardView onDataChanged={handleManualSync} />}
        {activeTab === 'menu' && <MenuManager onDataChanged={handleManualSync} />}
        {activeTab === 'report' && <ReportView />}
      </main>
    </div>
  );
}

export default App;
