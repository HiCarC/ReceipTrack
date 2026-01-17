import { useCallback, useEffect, useRef, useState } from 'react';

export default function useReceiptCamera({
  toast,
  setCaptureSource,
  setFile,
  setPreviewImageSrc,
  setShowFullScreenPreview,
}) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [pendingFlash, setPendingFlash] = useState(null);

  const videoElementRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = useCallback(async () => {
    const videoElement = videoElementRef.current;
    if (!videoElement) {
      console.error('Attempted to start camera but video element is null.');
      toast({
        title: "Camera Error",
        description: "Video element not available. Please try again.",
        variant: "destructive",
      });
      setIsCameraReady(false);
      return;
    }

    if (videoElement.srcObject) {
      setIsCameraReady(true);
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      videoElement.srcObject = stream;
      videoElement.muted = true;
      videoElement.onloadedmetadata = () => {
        videoElement.play()
          .then(() => {
            setIsCameraReady(true);
          })
          .catch(error => {
            console.error('Error playing video:', error);
            setIsCameraReady(false);
          });
      };
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Access Denied",
        description: "Please grant camera access to use this feature.",
        variant: "destructive",
      });
      setIsCameraReady(false);
    }
  }, [toast]);

  const videoRef = useCallback((node) => {
    videoElementRef.current = node;
    if (node && isCameraOpen && !isCameraReady) {
      startCamera();
    }
  }, [isCameraOpen, isCameraReady, startCamera]);

  const stopCamera = useCallback(() => {
    const videoElement = videoElementRef.current;
    if (videoElement && videoElement.srcObject) {
      const tracks = videoElement.srcObject.getTracks();
      tracks.forEach(track => {
        try {
          if (track.getCapabilities && track.getCapabilities().torch) {
            track.applyConstraints({ advanced: [{ torch: false }] });
          }
        } catch {}
        track.stop();
        track.enabled = false;
      });
      videoElement.srcObject = null;
    }
    setIsCameraOpen(false);
    setIsCameraReady(false);
    setIsFlashOn(false);
    setPendingFlash(null);
  }, []);

  const handleOpenCamera = useCallback(() => {
    setIsCameraOpen(true);
    if (videoElementRef.current && !isCameraReady) {
      startCamera();
    }
  }, [isCameraReady, startCamera]);

  const applyFlash = useCallback(async (nextState) => {
    const videoElement = videoElementRef.current;
    const stream = videoElement && videoElement.srcObject;
    const track = stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
    const capabilities = track && track.getCapabilities ? track.getCapabilities() : {};
    if (!track || !capabilities.torch) {
      toast({
        title: "Flash Unavailable",
        description: "Torch is not supported on this device.",
        variant: "destructive",
      });
      return false;
    }
    try {
      await track.applyConstraints({ advanced: [{ torch: nextState }] });
      setIsFlashOn(nextState);
      return true;
    } catch (error) {
      console.error('Failed to toggle flash:', error);
      toast({
        title: "Flash Error",
        description: "Unable to toggle the flash.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  const handleToggleFlash = useCallback(async () => {
    if (!isCameraOpen || !isCameraReady) {
      setPendingFlash(!isFlashOn);
      handleOpenCamera();
      return;
    }
    await applyFlash(!isFlashOn);
  }, [applyFlash, handleOpenCamera, isCameraOpen, isCameraReady, isFlashOn]);

  const capturePhoto = useCallback(() => {
    const videoElement = videoElementRef.current;
    if (videoElement && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoElement.videoWidth;
      canvasRef.current.height = videoElement.videoHeight;
      context.drawImage(videoElement, 0, 0, canvasRef.current.width, canvasRef.current.height);

      const previewDataUrl = canvasRef.current.toDataURL('image/jpeg');
      setCaptureSource('camera');
      setPreviewImageSrc(previewDataUrl);
      setShowFullScreenPreview(true);
      setIsCameraOpen(false);
      stopCamera();

      canvasRef.current.toBlob((blob) => {
        if (blob) {
          const capturedFile = new File([blob], 'captured-receipt.jpg', { type: 'image/jpeg' });
          setFile(capturedFile);
        } else {
          setFile(null);
        }
      }, 'image/jpeg', 0.9);
    } else {
      toast({
        title: "Camera Error",
        description: "Camera not ready yet. Please try again.",
        variant: "destructive",
      });
    }
  }, [setCaptureSource, setFile, setPreviewImageSrc, setShowFullScreenPreview, stopCamera, toast]);

  useEffect(() => {
    if (!isCameraOpen) return;
    if (videoElementRef.current && !isCameraReady) {
      startCamera();
    }
  }, [isCameraOpen, isCameraReady, startCamera]);

  useEffect(() => {
    if (!isCameraOpen || !isCameraReady || pendingFlash === null) return;
    const desiredState = pendingFlash;
    setPendingFlash(null);
    void applyFlash(desiredState);
  }, [applyFlash, isCameraOpen, isCameraReady, pendingFlash]);

  return {
    canvasRef,
    videoRef,
    isCameraOpen,
    setIsCameraOpen,
    isCameraReady,
    isFlashOn,
    handleOpenCamera,
    handleToggleFlash,
    capturePhoto,
    stopCamera,
  };
}
