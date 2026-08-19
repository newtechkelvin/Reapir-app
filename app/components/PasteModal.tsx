'use client';

import React from 'react';

interface PasteModalProps {
  showPasteModal: boolean;
  setShowPasteModal: (show: boolean) => void;
  pasteText: string;
  setPasteText: (text: string) => void;
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 print:hidden">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-lg font-bold text-gray-800">從 Excel 或試算表批量貼上</h3>
          <button
            type="button"
            onClick={() => setShowPasteModal(false)}
            className="text-gray-400 hover:text-gray-600 font-bold text-xl cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded-lg">
          <p className="font-semibold text-blue-900">💡 貼上說明：可以從 Excel 複製多列項目貼到下方。</p>
        </div>

        <textarea
          rows={8}
          placeholder="例如：更換機油、剎車皮更換"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
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