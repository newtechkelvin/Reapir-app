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
  // 紀錄哪張工單被點擊展開詳情 Modal
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  // 員工手動填寫完成狀態紀錄 (單機暫存/即時呈現)
  const [orderStatusMap, setOrderStatusMap] = useState>({});

  const toggleOrderCompletion = (orderId: string, completed: boolean) => {
    setOrderStatusMap(prev => ({
      ...prev,
      [orderId]: {
        completed,
        workerName: prev[orderId]?.workerName || ''
      }
    }));
  };

  const updateWorkerName = (orderId: string, name: string) => {
    setOrderStatusMap(prev => ({
      ...prev,
      [orderId]: {
        completed: prev[orderId]?.completed ?? true,
        workerName: name
      }
    }));
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
                      
                    

                    
                      
                        車架號碼 (VIN)：
                        {vehicle.vin || '未設定'}
                      
                      
                        所屬項目 (Project)：
                        {vehicle.project || '未設定'}
                      
                      
                        品牌與車型：
                        
                          {(vehicle.brand || '未設定') + ' - ' + (vehicle.model || '未設定')}
                        
                      
                      
                        車輛位置：
                        {vehicle.location || '未設定'}
                      
                      
                        Claim Form 日期：
                        {vehicle.claim_form_date || '未設定'}
                      
                      
                        最後維修時間：
                        
                          {vehicle.last_repair_date
                            ? new Date(vehicle.last_repair_date).toLocaleString()
                            : '無歷史紀錄'}
                        
                      
                    

                    {hasSummary && (
                      
                        過往曾維修與更換項目彙整：
                        
                          {vehicle.maintenance_items_summary.map((item: string, idx: number) => (
                            
                              {item}
                            
                          ))}
                        
                      
                    )}

                    {hasOrders && (
                      
                        歷史工單紀錄 (點擊可檢視詳細內容)：
                        
                          {vehicle.workOrders.map((wo: any) => {
                            const currentStatus = orderStatusMap[wo.id];
                            const isDone = currentStatus?.completed ?? false;

                            return (
                               setSelectedWorkOrder({ ...wo, plate_number: vehicle.plate_number, location: vehicle.location })}
                                className="border rounded-lg p-3 bg-white text-black shadow-xs hover:border-blue-500 hover:shadow-md cursor-pointer transition-all text-sm group"
                              >
                                
                                  
                                    
                                      📋 {wo.order_number}
                                    
                                    {wo.project && (
                                      
                                        {wo.project}
                                      
                                    )}
                                  
                                  
                                    {isDone ? (
                                      ✓ 員工已確認完成
                                    ) : (
                                      點擊開啟完整工單
                                    )}
                                    
                                      {new Date(wo.created_at).toLocaleDateString()}
                                    
                                  
                                
                                描述：{wo.description || '無'}
                                
                                  維修項目：
                                  {wo.work_order_items?.map((i: any) => i.item_name).join('、 ') || '無'}
                                
                              
                            );
                          })}
                        
                      
                    )}
                  
                );
              })}
            
          )}
        
      )}

      {/* 工單完整詳細內容 Modal 視窗 */}
      {selectedWorkOrder && (
        
          
            
              
                
                  工單明細表：{selectedWorkOrder.order_number}
                
                
                  開單時間：{new Date(selectedWorkOrder.created_at).toLocaleString()}
                
              
               setSelectedWorkOrder(null)}
                className="text-gray-400 hover:text-gray-700 font-bold text-2xl cursor-pointer print:hidden"
              >
                ✕
              
            

            {/* 基本資訊 */}
            
              車牌號碼：{selectedWorkOrder.plate_number}
              專案項目：{selectedWorkOrder.project || '無'}
              車輛位置：{selectedWorkOrder.location || '未設定'}
              工單狀態：{selectedWorkOrder.status || '已開單'}
            

            
              維修狀況描述：
              
                {selectedWorkOrder.description || '無描述備註'}
              
            

            {/* 逐項維修明細表格 */}
            
              維修與更換項目清單：
              
                
                    {selectedWorkOrder.work_order_items && selectedWorkOrder.work_order_items.length > 0 ? (
                      selectedWorkOrder.work_order_items.map((item: any, idx: number) => (
                        
                      ))
                    ) : (
                      
                    )}
                  
                  
                    
                      類別
                      項目與零件名稱
                    
                  
                  
                          
                            
                              {item.type === 'Part' ? '零件與耗材' : '工時與服務'}
                            
                          
                          {item.item_name}
                        
                        無細項紀錄
                      
                
              
            

            {/* 員工簽核填寫區 */}
            
              
                ✍️ 員工維修完成填寫與確認欄位：
              
              
                
                   toggleOrderCompletion(selectedWorkOrder.id, e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  此工單所有維修項目已全部完成
                

                
                  負責員工姓名：
                   updateWorkerName(selectedWorkOrder.id, e.target.value)}
                    className="p-1.5 border rounded text-xs w-full text-black bg-white"
                  />
                
              
            

            
               window.print()}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 text-sm"
              >
                🖨️ 列印此單據
              
               setSelectedWorkOrder(null)}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 text-sm"
              >
                關閉並儲存進度
              
            
          
        
      )}
    
  );
}