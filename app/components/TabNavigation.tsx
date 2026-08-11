'use client';

import React from 'react';

interface TabNavigationProps {
  activeTab: 'create' | 'search';
  setActiveTab: (tab: 'create' | 'search') => void;
}

export default function TabNavigation({ activeTab, setActiveTab }: TabNavigationProps) {
  const createBtnStyle =
    activeTab === 'create'
      ? 'flex-1 py-3 text-center font-medium cursor-pointer border-b-2 border-blue-600 text-blue-600'
      : 'flex-1 py-3 text-center font-medium cursor-pointer text-gray-500 hover:text-gray-700';

  const searchBtnStyle =
    activeTab === 'search'
      ? 'flex-1 py-3 text-center font-medium cursor-pointer border-b-2 border-blue-600 text-blue-600'
      : 'flex-1 py-3 text-center font-medium cursor-pointer text-gray-500 hover:text-gray-700';

  return (
    
       setActiveTab('create')}
      >
        開立新工單
      
       setActiveTab('search')}
      >
        車牌、VIN 與專案綜合搜尋
      
    
  );
}
