import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Camera, FileText, X } from 'lucide-react';

export default function ReceiptCameraDialog({
  isCameraOpen,
  setIsCameraOpen,
  stopCamera,
  videoRef,
  canvasRef,
  rotation,
  isCameraReady,
  capturePhoto,
  onManualEntry,
}) {
  return (
    <Dialog
      open={isCameraOpen}
      onOpenChange={(open) => {
        if (!open) {
          stopCamera();
        }
        setIsCameraOpen(open);
      }}
    >
      <DialogContent className="sm:max-w-[600px] bg-slate-800 text-white border-gray-700 p-6 rounded-lg shadow-xl animate-fade-in flex flex-col items-center">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-bold text-gray-100">Take Photo</DialogTitle>
          <DialogDescription className="text-gray-400">
            Position your receipt within the frame and click capture. Your receipt will be automatically processed and saved.
          </DialogDescription>
        </DialogHeader>
        <div className="relative w-full max-w-[560px] h-[420px] bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
          {!isCameraReady && (
            <p className="absolute text-gray-400">Camera not ready or access denied.</p>
          )}
          <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
            <div className="w-full h-full border-2 border-dashed border-blue-400 rounded-lg opacity-70 flex items-center justify-center text-blue-300 text-sm font-semibold text-center leading-tight">
              Point at the receipt.<br />
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden"></canvas>
        </div>
        <div className="mt-4 w-full flex flex-col gap-3">
          <div className="flex items-center justify-between"></div>
          <div className="flex items-center justify-between">
            <Button onClick={stopCamera} className="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded">
              <X className="h-5 w-5 mr-2" /> Close
            </Button>
            <Button
              onClick={() => {
                stopCamera();
                if (onManualEntry) onManualEntry();
              }}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded"
            >
              <FileText className="h-5 w-5 mr-2" /> Manual
            </Button>
            <Button
              onClick={capturePhoto}
              disabled={!isCameraReady}
              className="relative bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-full animate-pulse-fab"
            >
              <span className="absolute -inset-1 rounded-full bg-blue-400/30 blur-lg" aria-hidden="true"></span>
              <Camera className="h-5 w-5 mr-2" /> Shutter
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
