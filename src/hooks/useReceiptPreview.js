import { useCallback } from 'react';
import { fileFromPreview } from '@/utils/ocrPreviewUtils';

export default function useReceiptPreview({
  file,
  setFile,
  previewImageSrc,
  setPreviewImageSrc,
  setShowFullScreenPreview,
  setProcessingStage,
  captureSource,
  setCaptureSource,
  setIsCameraOpen,
  stopCamera,
  setCurrentStep,
  handleOpenCamera,
  processOCR,
  toast,
  onTabChange,
}) {
  const handleImageChange = useCallback((e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setCaptureSource('upload');
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImageSrc(event.target.result);
        setShowFullScreenPreview(true);
      };
      reader.readAsDataURL(selectedFile);
      e.target.value = null;
    }
  }, [setCaptureSource, setFile, setPreviewImageSrc, setShowFullScreenPreview]);

  const handleConfirmPreview = useCallback(() => {
    setShowFullScreenPreview(false);
    setCaptureSource(null);
    setIsCameraOpen(false);
    if (stopCamera) {
      stopCamera();
    }
    if (onTabChange) {
      onTabChange('expenses');
    }
    if (file) {
      setProcessingStage('detecting_edges');
      setTimeout(() => setProcessingStage('enhancing'), 400);
      setTimeout(() => setProcessingStage('reading_text'), 800);
      processOCR(file).finally(() => setProcessingStage('parsed'));
    } else {
      fileFromPreview(previewImageSrc)
        .then((imageFile) => {
          setProcessingStage('detecting_edges');
          setTimeout(() => setProcessingStage('enhancing'), 400);
          setTimeout(() => setProcessingStage('reading_text'), 800);
          processOCR(imageFile).finally(() => setProcessingStage('parsed'));
        })
        .catch((error) => {
          console.error('Error creating file from preview:', error);
          toast({
            title: 'Error Processing Image',
            description: 'Failed to process the captured image. Please try again.',
            variant: 'destructive',
          });
        });
    }
  }, [
    file,
    previewImageSrc,
    processOCR,
    setCaptureSource,
    setIsCameraOpen,
    setProcessingStage,
    setShowFullScreenPreview,
    stopCamera,
    toast,
  ]);

  const handleRetakePreview = useCallback(() => {
    setShowFullScreenPreview(false);
    setPreviewImageSrc(null);
    setFile(null);
    setProcessingStage(null);
    setIsCameraOpen(false);
    if (stopCamera) {
      stopCamera();
    }
    if (captureSource === 'camera') {
      setCaptureSource(null);
      handleOpenCamera();
      return;
    }
    setCaptureSource(null);
    setCurrentStep('upload_options');
  }, [
    captureSource,
    handleOpenCamera,
    setCaptureSource,
    setCurrentStep,
    setFile,
    setIsCameraOpen,
    setPreviewImageSrc,
    setProcessingStage,
    setShowFullScreenPreview,
    stopCamera,
  ]);

  return {
    handleImageChange,
    handleConfirmPreview,
    handleRetakePreview,
  };
}
