'use client';

// =============================================================================
// [Patent Technology] Electronic Signature Pad Component
// Canvas-based signature capture with touch and mouse support
// UI/UX 개선 버전
// =============================================================================

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface SignaturePadProps {
  onSignatureChange: (signatureData: string | null) => void;
  width?: number;
  height?: number;
  backgroundColor?: string;
  penColor?: string;
  penWidth?: number;
  disabled?: boolean;
}

export default function SignaturePad({
  onSignatureChange,
  width = 500,
  height = 200,
  backgroundColor = '#ffffff',
  penColor = '#1e40af',
  penWidth = 2.5,
  disabled = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [strokeHistory, setStrokeHistory] = useState<ImageData[]>([]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw guide line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(40, height - 50);
    ctx.lineTo(width - 40, height - 50);
    ctx.stroke();
    ctx.setLineDash([]);

    // Set drawing style
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [width, height, backgroundColor, penColor, penWidth]);

  // Get position from event
  const getPosition = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  }, []);

  // Save current state for undo
  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setStrokeHistory(prev => [...prev.slice(-10), imageData]);
  }, []);

  // Start drawing
  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();

    saveState();
    const pos = getPosition(e);
    lastPos.current = pos;
    setIsDrawing(true);
    setIsActive(true);
  }, [disabled, getPosition, saveState]);

  // Draw
  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPos.current) return;

    const pos = getPosition(e);

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPos.current = pos;
    setIsEmpty(false);
  }, [isDrawing, disabled, getPosition, penColor, penWidth]);

  // End drawing
  const endDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setIsActive(false);
    lastPos.current = null;

    // Export signature data
    if (!isEmpty) {
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        onSignatureChange(dataUrl);
      }
    }
  }, [isDrawing, isEmpty, onSignatureChange]);

  // Undo last stroke
  const undoStroke = useCallback(() => {
    if (strokeHistory.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const previousState = strokeHistory[strokeHistory.length - 1];
    ctx.putImageData(previousState, 0, 0);
    setStrokeHistory(prev => prev.slice(0, -1));

    // Check if empty (by comparing with initial state)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isCanvasEmpty = imageData.data.every((value, index) => {
      if (index % 4 === 3) return true; // alpha
      return value === 255; // white
    });

    if (isCanvasEmpty || strokeHistory.length <= 1) {
      setIsEmpty(true);
      onSignatureChange(null);
    } else {
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange(dataUrl);
    }
  }, [strokeHistory, onSignatureChange]);

  // Clear signature
  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear and redraw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Redraw guide line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(40, height - 50);
    ctx.lineTo(width - 40, height - 50);
    ctx.stroke();
    ctx.setLineDash([]);

    setIsEmpty(true);
    setStrokeHistory([]);
    onSignatureChange(null);
  }, [backgroundColor, width, height, onSignatureChange]);

  return (
    <div className="signature-pad-wrapper">
      {/* Canvas Container */}
      <div
        className={`relative rounded-xl border-2 transition-all duration-200 overflow-hidden ${
          disabled
            ? 'border-gray-200 bg-gray-100 opacity-60'
            : isActive
            ? 'border-blue-500 shadow-lg shadow-blue-500/20'
            : isEmpty
            ? 'border-dashed border-gray-300 bg-gray-50/50 hover:border-blue-400 hover:bg-blue-50/30'
            : 'border-solid border-green-400 bg-white'
        }`}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          style={{
            cursor: disabled ? 'not-allowed' : 'crosshair',
            touchAction: 'none',
            width: '100%',
            height: 'auto',
            aspectRatio: `${width} / ${height}`,
            display: 'block',
          }}
        />

        {/* Placeholder Text */}
        {isEmpty && !disabled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <p className="text-gray-400 text-sm">위 영역에 서명해 주세요</p>
            <p className="text-gray-300 text-xs mt-1">마우스 또는 터치로 서명</p>
          </div>
        )}

        {/* Status Badge */}
        {!isEmpty && !disabled && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-green-500 text-white rounded-full text-xs font-medium shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            서명됨
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={undoStroke}
            disabled={disabled || strokeHistory.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              disabled || strokeHistory.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            되돌리기
          </button>

          <button
            type="button"
            onClick={clearSignature}
            disabled={disabled || isEmpty}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              disabled || isEmpty
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            전체 지우기
          </button>
        </div>

        {/* Info */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          서명은 위임장에 포함됩니다
        </div>
      </div>

      {/* Legal Notice */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-700">전자서명 법적 효력</p>
            <p className="text-xs text-blue-600 mt-0.5">
              본 전자서명은 전자서명법 및 행정사법에 따라 법적 효력을 가집니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
