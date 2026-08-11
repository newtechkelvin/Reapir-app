'use client';

import React from 'react';

interface TabNavigationProps {
  activeTab: 'create' | 'search';
  setActiveTab: (tab: 'create' | 'search') => void;
}

export default function TabNavigation({ activeTab, setActiveTab }: TabNavigationProps) {
  function handleCreate() {
    setActiveTab('create');
  }

  function handleSearch() {
    setActiveTab('search');
  }

  const createClass = activeTab === 'create'
    ? 'flex-1 py-3 text-center font-medium cursor-pointer border-b-2 border-blue-600 text-blue-600'
    : 'flex-1 py-3 text-center font-medium cursor-pointer text-gray-500 hover:text-gray-700';

  const searchClass = activeTab === 'search'
    ? 'flex-1 py-3 text-center font-medium cursor-pointer border-b-2 border-blue-600 text-blue-600'
    : 'flex-1 py-3 text-center font-medium cursor-pointer text-gray-500 hover:text-gray-700';

  return (
    
      
        開立新工單
      
      
        車牌、VIN 與專案綜合搜尋
      
    
  );
}
