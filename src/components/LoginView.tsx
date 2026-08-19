import React, { useState, useEffect } from 'react';
import { localDB } from '../database';
import { ShieldCheck, Delete, Key } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [restaurantName, setRestaurantName] = useState<string>('');

  useEffect(() => {
    setRestaurantName(localDB.getRestaurantName());
  }, []);

  const handleKeyPress = (num: string) => {
    setErrorMsg('');
    if (password.length < 8) {
      setPassword(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPassword(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPassword('');
    setErrorMsg('');
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const correctPassword = localDB.getPassword();
    if (password === correctPassword) {
      onLoginSuccess();
    } else {
      setErrorMsg('密碼錯誤，請再試一次！');
      setPassword('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-emerald-800 to-teal-900 text-white px-4">
      <div className="w-full max-w-md bg-white text-gray-900 rounded-2xl shadow-2xl p-8 flex flex-col items-center">
        {/* Restaurant Title */}
        <h1 className="text-3xl font-extrabold text-emerald-800 mb-2 tracking-wide text-center">
          🍢 {restaurantName}
        </h1>
        <p className="text-sm text-gray-500 mb-8 font-medium">餐飲管理 POS 系統</p>

        {/* Input box showing dots/numbers */}
        <div className="w-full mb-6">
          <div className="flex items-center justify-center space-x-3 bg-gray-100 border-2 border-gray-200 rounded-xl px-4 py-3 h-14">
            {password.length === 0 ? (
              <span className="text-gray-400 text-sm flex items-center space-x-1">
                <Key size={16} />
                <span>請輸入密碼</span>
              </span>
            ) : (
              <div className="flex space-x-3">
                {password.split('').map((_, i) => (
                  <span key={i} className="h-3.5 w-3.5 rounded-full bg-emerald-700 animate-pulse"></span>
                ))}
              </div>
            )}
          </div>
          {errorMsg && (
            <p className="text-red-500 text-sm font-semibold mt-2 text-center">{errorMsg}</p>
          )}
        </div>

        {/* Numeric Keypad (Optimized for Tablets/Touch screens) */}
        <div className="grid grid-cols-3 gap-3 w-full mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="py-4 text-2xl font-bold bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-200 rounded-xl transition-all shadow-sm active:scale-95"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="py-4 text-lg font-bold text-red-500 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 rounded-xl transition-all shadow-sm active:scale-95"
          >
            清除
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="py-4 text-2xl font-bold bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-200 rounded-xl transition-all shadow-sm active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="py-4 flex justify-center items-center font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-200 rounded-xl transition-all shadow-sm active:scale-95"
          >
            <Delete size={24} />
          </button>
        </div>

        {/* Login Submit Button */}
        <button
          onClick={() => handleSubmit()}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-lg font-bold shadow-md transition-all active:scale-95 flex justify-center items-center space-x-2"
        >
          <ShieldCheck size={22} />
          <span>確認登入</span>
        </button>

        {/* Default hint for demo ease of use */}
        <div className="mt-6 text-xs text-gray-400 text-center">
          預設登入密碼為：<span className="font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold border">1234</span>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
