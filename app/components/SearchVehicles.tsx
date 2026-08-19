'use client';

import React, { useState } from 'react';

interface SearchVehiclesProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleSearch: (e?: React.FormEvent) => void;
  isSearching: boolean;
  hasSearched: boolean;
  searchVehicles: any[];
  getMaintenanceStatus: (dateStr: string) => { label: string; color: string; daysRemainingText?: string };
  exportToCSV: () => void;
  handlePrint: () => void;
}

interface OrderProgressState {
  completedItems: Record;
  isAllDone: boolean;
  completionDate: string;
  workerName: string;
}

export default function SearchVehicles({
  searchQuery,
  setSearchQuery,
  handleSearch,
  isSearching,
  hasSearched,
  searchVehicles,
  getMaintenanceStatus,
  exportToCSV,
  handlePrint,
}: SearchVehiclesProps) {
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [orderProgressMap, setOrderProgressMap] = useState>({});

  const getOrderState = (orderId: string, itemsCount: number): OrderProgressState => {
    if (!orderProgressMap[orderId]) {
      return {
        completedItems: {},
        isAllDone: false,
        completionDate: new Date().toISOString().slice(0, 10),
        workerName: '',
      };
    }
    return orderProgressMap[orderId];
  };

  const toggleItemDone = (orderId: string, itemIdx: number, totalItemsCount: number) => {
    setOrderProgressMap((prev) => {
      const current = prev[orderId] || {
        completedItems: {},
        isAllDone: false,
        completionDate: new Date().toISOString().slice(0, 10),
        workerName: '',
      };

      const newItems = {
        ...current.completedItems,
        [itemIdx]: !current.completedItems[itemIdx],
      };

      const doneCount = Object.values(newItems).filter(Boolean).length;
      const isAllCheckedNow = doneCount === totalItemsCount && totalItemsCount > 0;

      return {
        ...prev,
        [orderId]: {
          ...current,
          completedItems: newItems,
          isAllDone: isAllCheckedNow ? current.isAllDone : false,
        },
      };
    });
  };

  const toggleAllDone = (orderId: string, totalItemsCount: number) => {
    const state = getOrderState(orderId, totalItemsCount);
    const doneCount = Object.values(state.completedItems).filter(Boolean).length;

    if (doneCount < totalItemsCount) {
      alert('必須先將下方清單中每一項維修與零件皆勾選完成，才能點選「已全部完成」！');
      return;
    }

    setOrderProgressMap((prev) => ({
      ...prev,
      [orderId]: {
        ...state,
        isAllDone: !state.isAllDone,
      },
    }));
  };

  const updateOrderField = (orderId: string, field: 'completionDate' | 'workerName', value: string, totalItemsCount: number) => {
    const state = getOrderState(orderId, totalItemsCount);
    setOrderProgressMap((prev) => ({
      ...prev,
      [orderId]: {
        ...state,
        [field]: value,
      },
    }));
  };

  const calculateDaysWorked = (startDateStr: string, endDateStr: string) => {
    if (!startDateStr || !endDateStr) return 1;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
    return diffDays < 0 ? 1 : diffDays + 1;
  };

  return (
    
      
         setSearchQuery(e.target.value)}
          className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black text-base md:text-lg"
        />
        
          {isSearching ? '搜尋中...' : '搜尋'}
        
      

      {hasSearched && (
        
          {searchVehicles.length === 0 ? (
            查無符合搜尋條件的車輛或工單紀錄。
          ) : (
            
              
                找到 {searchVehicles.length} 筆符合條件的車輛紀錄
                
                  📊 匯出 CSV 試算表
                  🖨️ 列印履歷與存為 PDF
                
              

              {searchVehicles.map((vehicle: any) => {
                const status = getMaintenanceStatus(vehicle.next_maintenance_date);
                const hasSummary = vehicle.maintenance_items_summary && vehicle.maintenance_items_summary.length > 0;
                const hasOrders = vehicle.workOrders && vehicle.workOrders.length > 0;

                return (
                  
                    
                      車牌：{vehicle.plate_number}
                      保養狀態：{status.label}
                    

                    
                      車架號碼 (VIN)：{vehicle.vin || '未設定'}
                      所屬專案 (Project)：{vehicle.project || '未設定'}
                      品牌與車型：{(vehicle.brand || '未設定') + ' - ' + (vehicle.model || '未設定')}
                      車輛位置：{vehicle.location || '未設定'}
                      Claim Form 日期：{vehicle.claim_form_date || '未設定'}
                      最後維修時間：{vehicle.last_repair_date ? new Date(vehicle.last_repair_date).toLocaleString() : '無歷史紀錄'}
                    

                    {hasSummary && (
                      
                        過往曾維修與更換項目彙整：
                        
                          {vehicle.maintenance_items_summary.map((item: string, idx: number) => (
                            {item}
                          ))}
                        
                      
                    )}

                    {hasOrders && (
                      
                        歷史工單紀錄 (點擊可檢視詳細內容)：
                        
                          {vehicle.workOrders.map((wo: any) => {
                            const totalItems = wo.work_order_items?.length || 0;
                            const state = getOrderState(wo.id, totalItems);
                            const doneCount = Object.values(state.completedItems).filter(Boolean).length;
                            const progressPct = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;
                            const isCompleted = state.isAllDone;
                            const daysWorked = calculateDaysWorked(wo.created_at, state.completionDate);

                            return (
                               setSelectedWorkOrder({ ...wo, plate_number: vehicle.plate_number, location: vehicle.location, vehicle_project: vehicle.project })}
                                className="border rounded-lg p-3 bg-white text-black shadow-xs hover:border-blue-500 hover:shadow-md cursor-pointer transition-all text-sm group"
                              >
                                
                                  
                                    📋 {wo.order_number}
                                    {(wo.project || vehicle.project) && (
                                      
                                        {wo.project || vehicle.project}
                                      
                                    )}
                                  
                                  
                                    
                                      狀態: {isCompleted ? 'Completed' : 'Open'}
                                    
                                    {new Date(wo.created_at).toLocaleDateString()}
                                  
                                

                                
                                  
                                    完成進度:
                                    
                                      
                                    
                                    {progressPct}%
                                  

                                  {isCompleted && (
                                    
                                      ⏱️ 工作耗時: {daysWorked} 天 (完成日: {state.completionDate})
                                    
                                  )}
                                

                                描述：{wo.description || '無'}
                                
                                  維修項目 ({doneCount}/{totalItems})：
                                  {wo.work_order_items?.map((i: any) => i.item_name).join('、 ') || '無'}
                                
                              
                            );
                          })}
                        
                      
                    )}
                  
                );
              })}
            
          )}
        
      )}

      {selectedWorkOrder && (
        
          
            {(() => {
              const totalItems = selectedWorkOrder.work_order_items?.length || 0;
              const state = getOrderState(selectedWorkOrder.id, totalItems);
              const doneCount = Object.values(state.completedItems).filter(Boolean).length;
              const isAllItemsChecked = doneCount === totalItems && totalItems > 0;
              const currentStatusText = state.isAllDone ? 'Completed' : 'Open';

              return (
                <>
                  
                    
                      工單明細表：{selectedWorkOrder.order_number}
                      開單時間：{new Date(selectedWorkOrder.created_at).toLocaleString()}
                    
                     setSelectedWorkOrder(null)} className="text-gray-400 hover:text-gray-700 font-bold text-2xl cursor-pointer print:hidden">✕
                  

                  
                    車牌號碼：{selectedWorkOrder.plate_number}
                    專案項目：{selectedWorkOrder.project || selectedWorkOrder.vehicle_project || '無'}
                    車輛位置：{selectedWorkOrder.location || '未設定'}
                    
                      工單狀態：
                      
                        {currentStatusText}
                      
                    
                  

                  
                    維修狀況描述：
                    {selectedWorkOrder.description || '無描述備註'}
                  

                  
                    
                      維修與更換項目清單 (請員工逐項勾選完成)：
                      
                        進度：{doneCount} / {totalItems} 項完成
                      
                    

                    
                      
                          {selectedWorkOrder.work_order_items && selectedWorkOrder.work_order_items.length > 0 ? (
                            selectedWorkOrder.work_order_items.map((item: any, idx: number) => {
                              const isChecked = !!state.completedItems[idx];
                              return (
                                
                              );
                            })
                          ) : (
                            
                          )}
                        
                        
                          
                            類別
                            項目與零件名稱
                            完成狀態
                          
                        
                        
                                  
                                    
                                      {item.type === 'Part' ? '零件/耗材' : '工時/服務'}
                                    
                                  
                                  
                                    {item.item_name}
                                  
                                  
                                    
                                       toggleItemDone(selectedWorkOrder.id, idx, totalItems)}
                                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                                      />
                                      
                                        {isChecked ? '已完成' : '未完成'}
                                      
                                    
                                  
                                無細項紀錄
                      
                    
                  

                  
                    ✍️ 工單總結與完成確認：

                    
                      
                         toggleAllDone(selectedWorkOrder.id, totalItems)}
                          className="w-5 h-5 text-green-600 rounded focus:ring-green-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                        
                          已全部完成 (工單狀態將轉為 Completed)
                          {!isAllItemsChecked && (
                            ⚠️ 請先將上方所有單項皆勾選「已完成」
                          )}
                        
                      

                      
                        
                          完成日期：
                           updateOrderField(selectedWorkOrder.id, 'completionDate', e.target.value, totalItems)}
                            className="p-2 border rounded text-xs w-full text-black bg-white"
                          />
                        
                        
                          負責員工姓名：
                           updateOrderField(selectedWorkOrder.id, 'workerName', e.target.value, totalItems)}
                            className="p-2 border rounded text-xs w-full text-black bg-white"
                          />
                        
                      
                    
                  

                  
                     window.print()} className="px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 text-sm">🖨️ 列印此單據
                     setSelectedWorkOrder(null)} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 text-sm">儲存並關閉
                  
                
              );
            })()}
          
        
      )}
    
  );
}