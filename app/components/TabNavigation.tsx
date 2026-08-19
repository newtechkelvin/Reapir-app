'use client';

import React from 'react';

interface TabNavigationProps {
  activeTab: 'create' | 'search';
  setActiveTab: (tab: 'create' | 'search') => void;
}

export default function TabNavigation({ activeTab, setActiveTab }: TabNavigationProps) {
  const isCreate = activeTab === 'create';
  const isSearch = activeTab === 'search';

  return (
    <div className="flex border-b border-gray-200 mb-6 print:hidden">
      <button
        type="button"
        className={
          isCreate
            ? 'flex-1 py-3 text-center font-medium cursor-pointer border-b-2 border-blue-600 text-blue-600'
            : 'flex-1 py-3 text-center font-medium cursor-pointer text-gray-500 hover:text-gray-700'
        }
        onClick={() => setActiveTab('create')}
      >
        開立新工單
      </button>
      <button
        type="button"
        className={
          isSearch
            ? 'flex-1 py-3 text-center font-medium cursor-pointer border-b-2 border-blue-600 text-blue-600'
            : 'flex-1 py-3 text-center font-medium cursor-pointer text-gray-500 hover:text-gray-700'
        }
        onClick={() => setActiveTab('search')}
      >
        車牌、VIN、工單號與專案綜合搜尋
      </button>
    </div>
  );
}