import React, { useState, useEffect } from 'react';
import { localDB } from '../database';
import { MenuItem, MenuItemOption } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { Edit3, Trash2, Plus, Upload, Save, Store, QrCode, FileText, X } from 'lucide-react';

interface MenuManagerProps {
  onDataChanged: () => void;
}

const MenuManager: React.FC<MenuManagerProps> = ({ onDataChanged }) => {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  
  // UI Tabs inside setting page
  const [settingsTab, setSettingsTab] = useState<'restaurant' | 'dishes' | 'qrcodes'>('dishes');

  // Editing dish state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCategory, setEditCategory] = useState<string>('');
  const [editImage, setEditImage] = useState<string>('');
  const [editOptions, setEditOptions] = useState<MenuItemOption[]>([]);

  // New dish state
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newCategory, setNewCategory] = useState<string>('臭豆腐類');
  const [newImage, setNewImage] = useState<string>('');
  const [newOptions, setNewOptions] = useState<MenuItemOption[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setMenu(localDB.getMenu());
    setRestaurantName(localDB.getRestaurantName());
    setPassword(localDB.getPassword());
  };

  const handleSaveRestaurantSettings = () => {
    if (!restaurantName.trim()) {
      alert('店名不能為空！');
      return;
    }
    if (!password.trim() || password.length < 4) {
      alert('密碼至少需要 4 位數字！');
      return;
    }

    localDB.setRestaurantName(restaurantName.trim());
    localDB.setPassword(password.trim());
    
    // Add to offline sync queue
    localDB.addToOfflineQueue({
      type: 'UPDATE_RESTAURANT_NAME',
      payload: restaurantName.trim()
    });
    localDB.addToOfflineQueue({
      type: 'UPDATE_PASSWORD',
      payload: password.trim()
    });

    onDataChanged();
    alert('基本設定儲存成功！');
  };

  // Convert uploaded image file to base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'edit' | 'new') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit for base64 storage (limit to ~500kb to keep localStorage happy)
    if (file.size > 512 * 1024) {
      alert('圖片大小不能超過 512KB，以利於離線快取儲存！');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        if (target === 'edit') {
          setEditImage(reader.result);
        } else {
          setNewImage(reader.result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Delete MenuItem
  const handleDeleteItem = (id: string) => {
    if (!confirm('您確定要刪除這道菜色嗎？已送出的歷史訂單不受影響。')) return;

    const updatedMenu = menu.filter(item => item.id !== id);
    setMenu(updatedMenu);
    localDB.setMenu(updatedMenu);
    
    localDB.addToOfflineQueue({
      type: 'UPDATE_MENU',
      payload: updatedMenu
    });
    
    onDataChanged();
  };

  // Edit item start
  const handleStartEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(item.price);
    setEditCategory(item.category || '其它');
    setEditImage(item.image || '');
    setEditOptions(item.options || []);
    setIsAddingNew(false);
  };

  // Edit item cancel
  const handleCancelEdit = () => {
    setEditingId(null);
  };

  // Edit item save
  const handleSaveEdit = () => {
    if (!editName.trim()) {
      alert('菜名不能為空！');
      return;
    }
    if (editPrice <= 0) {
      alert('價格必須大於 0 元！');
      return;
    }

    const updatedMenu = menu.map(item => {
      if (item.id === editingId) {
        return {
          ...item,
          name: editName.trim(),
          price: editPrice,
          category: editCategory,
          image: editImage,
          options: editOptions.length > 0 ? editOptions : undefined
        };
      }
      return item;
    });

    setMenu(updatedMenu);
    localDB.setMenu(updatedMenu);

    localDB.addToOfflineQueue({
      type: 'UPDATE_MENU',
      payload: updatedMenu
    });

    setEditingId(null);
    onDataChanged();
  };

  // New item add option
  const handleAddOption = (target: 'edit' | 'new') => {
    const optName = prompt('請輸入加料選項名稱（例如：加起司）:');
    if (!optName) return;
    const optPriceStr = prompt('請輸入加料選項價格（例如：15）:');
    const optPrice = optPriceStr ? parseInt(optPriceStr, 10) : 0;
    if (isNaN(optPrice)) return;

    const newOpt = { name: optName, price: optPrice, selected: false };
    if (target === 'edit') {
      setEditOptions(prev => [...prev, newOpt]);
    } else {
      setNewOptions(prev => [...prev, newOpt]);
    }
  };

  const handleRemoveOption = (target: 'edit' | 'new', index: number) => {
    if (target === 'edit') {
      setEditOptions(prev => prev.filter((_, i) => i !== index));
    } else {
      setNewOptions(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Add new item save
  const handleSaveNewItem = () => {
    if (!newName.trim()) {
      alert('菜名不能為空！');
      return;
    }
    if (newPrice <= 0) {
      alert('價格必須大於 0 元！');
      return;
    }

    const newItem: MenuItem = {
      id: `menu_${Date.now()}`,
      name: newName.trim(),
      price: newPrice,
      category: newCategory,
      image: newImage,
      isSoldOut: false,
      options: newOptions.length > 0 ? newOptions : undefined
    };

    const updatedMenu = [...menu, newItem];
    setMenu(updatedMenu);
    localDB.setMenu(updatedMenu);

    localDB.addToOfflineQueue({
      type: 'UPDATE_MENU',
      payload: updatedMenu
    });

    // Reset new item form
    setIsAddingNew(false);
    setNewName('');
    setNewPrice(0);
    setNewCategory('臭豆腐類');
    setNewImage('');
    setNewOptions([]);
    
    onDataChanged();
  };

  // Toggle item sold out state
  const handleToggleSoldOut = (id: string) => {
    const updatedMenu = menu.map(item => {
      if (item.id === id) {
        return { ...item, isSoldOut: !item.isSoldOut };
      }
      return item;
    });

    setMenu(updatedMenu);
    localDB.setMenu(updatedMenu);

    localDB.addToOfflineQueue({
      type: 'UPDATE_MENU',
      payload: updatedMenu
    });

    onDataChanged();
  };

  // Generate ordering URL
  const getDineinOrderUrl = (tableNum: number) => {
    return `${window.location.origin}/?type=dinein&table=${tableNum}`;
  };

  const getTakeoutOrderUrl = () => {
    return `${window.location.origin}/?type=takeout`;
  };

  return (
    <div className="flex h-full gap-6 bg-white rounded-xl shadow-md p-6 overflow-hidden">
      {/* Side Tabs */}
      <aside className="w-56 border-r border-gray-200 pr-6 flex flex-col space-y-2 shrink-0">
        <button
          onClick={() => setSettingsTab('dishes')}
          className={`flex items-center space-x-2.5 py-3 px-4 rounded-xl font-bold transition-all text-sm ${
            settingsTab === 'dishes'
              ? 'bg-emerald-50 text-emerald-700'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FileText size={18} />
          <span>選單與價格管理</span>
        </button>
        <button
          onClick={() => setSettingsTab('qrcodes')}
          className={`flex items-center space-x-2.5 py-3 px-4 rounded-xl font-bold transition-all text-sm ${
            settingsTab === 'qrcodes'
              ? 'bg-emerald-50 text-emerald-700'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <QrCode size={18} />
          <span>餐桌二維條碼 QR Code</span>
        </button>
        <button
          onClick={() => setSettingsTab('restaurant')}
          className={`flex items-center space-x-2.5 py-3 px-4 rounded-xl font-bold transition-all text-sm ${
            settingsTab === 'restaurant'
              ? 'bg-emerald-50 text-emerald-700'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Store size={18} />
          <span>店鋪基本設定</span>
        </button>
      </aside>

      {/* Settings Panel Area */}
      <div className="flex-1 overflow-y-auto px-2">
        
        {/* TAB 1: DISHES LIST */}
        {settingsTab === 'dishes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800">選單品項列表</h3>
              {!isAddingNew && (
                <button
                  onClick={() => {
                    setIsAddingNew(true);
                    setEditingId(null);
                  }}
                  className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold transition active:scale-95"
                >
                  <Plus size={14} />
                  <span>新增菜色</span>
                </button>
              )}
            </div>

            {/* ADD NEW ITEM FORM */}
            {isAddingNew && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
                <h4 className="font-bold text-emerald-800 text-sm">新增菜色設定</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-600 block">菜色名稱 *</label>
                    <input 
                      type="text" 
                      value={newName} 
                      onChange={e => setNewName(e.target.value)}
                      placeholder="例如：招牌臭豆腐" 
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-gray-600 block">價格 (元) *</label>
                    <input 
                      type="number" 
                      value={newPrice || ''} 
                      onChange={e => setNewPrice(parseInt(e.target.value, 10) || 0)}
                      placeholder="65" 
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-gray-600 block">分類</label>
                    <select 
                      value={newCategory} 
                      onChange={e => setNewCategory(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="臭豆腐類">臭豆腐類</option>
                      <option value="主食類">主食類</option>
                      <option value="小菜類">小菜類</option>
                      <option value="創意點心">創意點心</option>
                      <option value="飲料類">飲料類</option>
                      <option value="伴手禮">伴手禮</option>
                    </select>
                  </div>
                </div>

                {/* Upload Image & Custom Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  {/* Image input */}
                  <div className="space-y-2">
                    <label className="font-bold text-gray-600 block">上傳菜品圖片 (大小限制512KB)</label>
                    <div className="flex items-center space-x-3">
                      <label className="flex items-center space-x-1.5 border border-dashed border-emerald-600 bg-white hover:bg-emerald-50 text-emerald-700 px-4 py-2.5 rounded-lg cursor-pointer transition font-bold text-xs shadow-sm">
                        <Upload size={14} />
                        <span>選取圖片</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={e => handleImageUpload(e, 'new')} 
                          className="hidden" 
                        />
                      </label>
                      {newImage && (
                        <div className="relative">
                          <img src={newImage} alt="Preview" className="h-12 w-12 object-cover rounded-lg border" />
                          <button 
                            type="button" 
                            onClick={() => setNewImage('')} 
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add Noodle / Custom Options */}
                  <div className="space-y-2">
                    <label className="font-bold text-gray-600 block">客製選項（例如：加王子麵 +15元）</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {newOptions.map((opt, i) => (
                        <span key={i} className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-2.5 py-1 rounded-lg font-bold flex items-center">
                          {opt.name} (+${opt.price})
                          <button 
                            type="button" 
                            onClick={() => handleRemoveOption('new', i)}
                            className="ml-1 text-red-500 hover:text-red-700 font-extrabold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddOption('new')}
                      className="flex items-center space-x-1 text-xs text-amber-700 hover:text-amber-800 font-bold"
                    >
                      <Plus size={14} />
                      <span>新增客製選項</span>
                    </button>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={handleSaveNewItem}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-xs font-bold transition shadow-sm active:scale-95"
                  >
                    <Save size={14} />
                    <span>確認新增</span>
                  </button>
                  <button
                    onClick={() => setIsAddingNew(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg px-4 py-2 text-xs font-bold transition"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* DISH CARDS LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {menu.map(item => {
                const isEditing = editingId === item.id;
                
                return (
                  <div key={item.id} className="border rounded-2xl p-4 bg-white flex flex-col justify-between hover:shadow-sm transition border-gray-200">
                    {isEditing ? (
                      // EDIT MODE INPUTS
                      <div className="space-y-4 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="font-bold text-gray-500 block mb-1">菜色名稱 *</label>
                            <input 
                              type="text" 
                              value={editName} 
                              onChange={e => setEditName(e.target.value)} 
                              className="w-full border rounded px-2.5 py-1.5 text-sm font-bold"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-gray-500 block mb-1">價格 *</label>
                            <input 
                              type="number" 
                              value={editPrice} 
                              onChange={e => setEditPrice(parseInt(e.target.value, 10) || 0)} 
                              className="w-full border rounded px-2.5 py-1.5 text-sm font-bold"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-gray-500 block mb-1">分類</label>
                            <input 
                              type="text" 
                              value={editCategory} 
                              onChange={e => setEditCategory(e.target.value)} 
                              className="w-full border rounded px-2.5 py-1.5 text-sm font-medium"
                            />
                          </div>
                        </div>

                        {/* Edit Image and Options */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="font-bold text-gray-500 block mb-1">修改圖片 (512KB內)</label>
                            <div className="flex items-center space-x-2">
                              <label className="border border-dashed border-gray-300 hover:bg-gray-50 px-2 py-1.5 rounded cursor-pointer font-bold">
                                <span>選圖片</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={e => handleImageUpload(e, 'edit')} 
                                  className="hidden" 
                                />
                              </label>
                              {editImage && (
                                <img src={editImage} alt="edit-preview" className="h-8 w-8 object-cover rounded border" />
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="font-bold text-gray-500 block mb-1">客製選項</label>
                            <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto mb-1">
                              {editOptions.map((opt, oidx) => (
                                <span key={oidx} className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center">
                                  {opt.name}(+{opt.price})
                                  <button type="button" onClick={() => handleRemoveOption('edit', oidx)} className="ml-1 text-red-500 font-bold">×</button>
                                </span>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddOption('edit')}
                              className="text-amber-700 hover:text-amber-800 font-bold text-[10px] flex items-center"
                            >
                              + 新增選項
                            </button>
                          </div>
                        </div>

                        <div className="flex space-x-2 pt-2 border-t">
                          <button
                            onClick={handleSaveEdit}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-1 font-bold shadow-sm"
                          >
                            儲存
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-600 rounded px-3 py-1 font-bold"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      // VIEW MODE
                      <div className="flex justify-between items-start">
                        <div className="flex space-x-3 items-center">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="h-16 w-16 object-cover rounded-xl border shrink-0" />
                          ) : (
                            <div className="h-16 w-16 bg-gray-100 rounded-xl border border-dashed flex justify-center items-center text-gray-300 text-xl font-bold shrink-0">
                              無圖
                            </div>
                          )}
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold text-gray-800 text-base">{item.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                                item.isSoldOut 
                                  ? 'bg-red-100 text-red-700' 
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {item.isSoldOut ? '已售罄' : '販售中'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-emerald-700 font-extrabold text-sm">${item.price}</span>
                              <span className="text-xs text-gray-400">| 分類: {item.category || '其它'}</span>
                            </div>
                            {item.options && item.options.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {item.options.map((o, idx) => (
                                  <span key={idx} className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
                                    {o.name} (+${o.price})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col space-y-1.5 items-end justify-between self-stretch">
                          <button
                            onClick={() => handleToggleSoldOut(item.id)}
                            className={`text-xs px-2 py-1 rounded font-bold border transition shadow-sm ${
                              item.isSoldOut 
                                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                            }`}
                            title="切換菜色售完狀態"
                          >
                            {item.isSoldOut ? '設為販售' : '設為售完'}
                          </button>
                          
                          <div className="flex space-x-1.5">
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="text-gray-500 hover:text-emerald-700 p-1.5 border hover:border-emerald-200 rounded-lg transition"
                              title="編輯"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-red-500 hover:text-red-700 p-1.5 border hover:border-red-200 rounded-lg transition"
                              title="刪除"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: QR CODES FOR CUSTOMERS */}
        {settingsTab === 'qrcodes' && (
          <div className="space-y-6">
            <div className="border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800">餐桌掃碼點餐 QR Code</h3>
              <p className="text-xs text-gray-500 mt-1">
                顧客掃描以下對應的二維條碼即可進行手機點餐，系統會自動帶入對應的桌號或標記為外帶。
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {/* Dine-in 1-5 Tables */}
              {[1, 2, 3, 4, 5].map(tableNum => {
                const url = getDineinOrderUrl(tableNum);
                return (
                  <div key={tableNum} className="border border-gray-200 bg-gray-50 rounded-2xl p-5 flex flex-col items-center shadow-sm">
                    <span className="font-extrabold text-gray-700 mb-3 text-base">內用 - 桌號 {tableNum}</span>
                    <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 mb-3">
                      <QRCodeSVG value={url} size={130} />
                    </div>
                    <div className="w-full space-y-2 mt-2">
                      <span className="text-[10px] font-mono text-gray-400 block text-center truncate" title={url}>
                        {url.substring(0, 40)}...
                      </span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold text-center block transition shadow-sm active:scale-95"
                      >
                        測試桌號 {tableNum} 點餐
                      </a>
                    </div>
                  </div>
                );
              })}

              {/* Takeout QR Code */}
              <div className="border-2 border-dashed border-teal-500 bg-teal-50/20 rounded-2xl p-5 flex flex-col items-center shadow-sm">
                <span className="font-extrabold text-teal-800 mb-3 text-base">外帶 QR Code</span>
                <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 mb-3">
                  <QRCodeSVG value={getTakeoutOrderUrl()} size={130} />
                </div>
                <div className="w-full space-y-2 mt-2">
                  <span className="text-[10px] font-mono text-gray-400 block text-center truncate" title={getTakeoutOrderUrl()}>
                    {getTakeoutOrderUrl().substring(0, 40)}...
                  </span>
                  <a
                    href={getTakeoutOrderUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold text-center block transition shadow-sm active:scale-95"
                  >
                    測試外帶點餐
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STORE CONFIGURATION */}
        {settingsTab === 'restaurant' && (
          <div className="space-y-6">
            <div className="border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800">店鋪基本設定</h3>
              <p className="text-xs text-gray-500 mt-1">修改餐廳名稱以及 POS 系統的安全登入密碼。</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 max-w-lg space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-gray-700 block text-sm">餐廳名稱 (店名) *</label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={e => setRestaurantName(e.target.value)}
                  className="w-full border rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-gray-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block text-sm">POS 系統登入密碼 (限數字) *</label>
                <input
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value.replace(/\D/g, ''))} // allow digits only
                  className="w-full border rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 text-sm font-mono font-bold text-gray-800"
                  maxLength={8}
                />
                <span className="text-[10px] text-gray-400">輸入 4 到 8 位數字密碼。</span>
              </div>

              <button
                onClick={handleSaveRestaurantSettings}
                className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition shadow active:scale-95 flex justify-center items-center space-x-1.5"
              >
                <Save size={16} />
                <span>儲存並同步基本設定</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MenuManager;
