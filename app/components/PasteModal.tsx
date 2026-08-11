'use client';

import React from 'react';

interface PasteModalProps {
  showPasteModal: boolean;
  setShowPasteModal: (v: boolean) => void;
  pasteText: string;
  setPasteText: (v: string) => void;
  handleApplyPaste: () => void;
}

export default function PasteModal({
  showPasteModal,
  setShowPasteModal,
  pasteText,
  setPasteText,
  handleApplyPaste,
}: PasteModalProps) {
  if (!showPasteModal) return null;

  return (
    
      
        
          
            從 Excel 或試算表批量貼上
          
           setShowPasteModal(false)}
            className="text-gray-400 hover:text-gray-600 font-bold text-xl cursor-pointer"
          >
            ✕
          
        

        
          
            貼上說明：可以從 Excel 複製多列項目貼到下方。
          
        

         setPasteText(e.target.value)}
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 text-black font-mono text-sm"
        />

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setShowPasteModal(false)}
            className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleApplyPaste}
            className="px-5 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 cursor-pointer"
          >
            解析並套用
          </button>
        </div>
      </div>
    </div>
  );
}
