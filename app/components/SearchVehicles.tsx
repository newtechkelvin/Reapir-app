'use client';

import React from 'react';

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
  function handleInputChange(e: React.ChangeEvent) {
    setSearchQuery(e.target.value);
  }

  function renderWorkOrderItems(items: any[]) {
    if (!items || items.length === 0) {
      return '無';
    }
    const names: string[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i] && items[i].item_name) {
        names.push(items[i].item_name);
      }
    }
    if (names.length === 0) {
      return '無';
    }
    return names.join('、 ');
  }

  return (
    
      
        
        
          {isSearching ? '搜尋中...' : '搜尋'}
        
      

      {hasSearched && (
        
          {searchVehicles.length === 0 ? (
            
              查無符合搜尋條件的車輛或保養紀錄。
            
          ) : (
            
              
                
                  找到 {searchVehicles.length} 筆符合條件的車輛紀錄
                
                
                  
                    匯出 CSV 試算表
                  
                  
                    列印履歷與存為 PDF
                  
                
              

              {searchVehicles.map(function (vehicle: any) {
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
                      
                      
                        保養到期日：
                        
                          {vehicle.next_maintenance_date || '未設定'}
                        
                      
                      
                        距離保養剩餘時間：
                        {status.daysRemainingText}
                      
                      
                        Claim Form 日期：
                        {vehicle.claim_form_date || '未設定'}
                      
                      
                        最後維修時間：
                        
                          {vehicle.last_repair_date
                            ? new Date(vehicle.last_repair_date).toLocaleString()
                            : '無歷史紀錄'}
                        
                      
                    

                    {hasSummary && (
                      
                        過往曾維修與更換項目彙整：
                        
                          {vehicle.maintenance_items_summary.map(function (item: string, idx: number) {
                            return (
                              
                                {item}
                              
                            );
                          })}
                        
                      
                    )}

                    {hasOrders && (
                      
                        歷史工單紀錄 ({vehicle.workOrders.length} 筆)：
                        
                          {vehicle.workOrders.map(function (wo: any) {
                            return (
                              
                                
                                  
                                    {wo.order_number}
                                    {wo.project && (
                                      
                                        {wo.project}
                                      
                                    )}
                                  
                                  
                                    {new Date(wo.created_at).toLocaleDateString()}
                                  
                                
                                備註描述：{wo.description || '無'}
                                
                                  維修項目：
                                  {renderWorkOrderItems(wo.work_order_items)}
                                
                              
                            );
                          })}
                        
                      
                    )}
                  
                );
              })}
            
          )}
        
      )}
    
  );
}
