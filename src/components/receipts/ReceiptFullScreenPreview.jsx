import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

export default function ReceiptFullScreenPreview({
  show,
  previewImageSrc,
  processingStage,
  handleRetakePreview,
  handleConfirmPreview,
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fade-in">
      <img src={previewImageSrc} alt="Captured receipt preview" className="flex-1 object-contain" />
      {processingStage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-800/80 border border-blue-400/30 text-blue-100 px-4 py-1 text-sm shadow-lg">
          {processingStage === 'detecting_edges' && 'Detecting edgesƒ?İ'}
          {processingStage === 'enhancing' && 'Enhancingƒ?İ'}
          {processingStage === 'reading_text' && 'Reading textƒ?İ'}
          {processingStage === 'parsed' && 'Parsed'}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pb-10">
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/30" />
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4 px-6">
          <Button
            onClick={handleRetakePreview}
            variant="outline"
            className="flex-1 text-lg py-3 px-6 bg-slate-700/80 border-slate-500 hover:bg-slate-600 text-white backdrop-blur-sm"
          >
            <XCircle className="h-5 w-5 mr-2" />
            Retake
          </Button>
          <Button
            onClick={handleConfirmPreview}
            className="flex-1 text-lg py-3 px-6 bg-blue-600/90 hover:bg-blue-500 text-white backdrop-blur-sm"
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Use Photo
          </Button>
        </div>
      </div>
    </div>
  );
}
