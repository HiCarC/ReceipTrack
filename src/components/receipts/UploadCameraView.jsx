import React from 'react';
import { Camera, Edit, Image, Users, X, Zap } from 'lucide-react';

export default function UploadCameraView({
  groups,
  selectedGroupId,
  setSelectedGroupId,
  groupSwitcherOpen,
  setGroupSwitcherOpen,
  isCameraOpen,
  isCameraReady,
  isFlashOn,
  scanMode,
  setScanMode,
  videoRef,
  fileInputRef,
  canvasRef,
  handleImageChange,
  handleManualEntry,
  handleOpenCamera,
  handleToggleFlash,
  capturePhoto,
  stopCamera,
  onTabChange,
  scannerBackground,
}) {
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-app-bg text-app-fg">
      <div className="absolute inset-0">
        {isCameraOpen ? (
          <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url('${scannerBackground}')` }}
          />
        )}
      </div>
      <div className="absolute inset-0 bg-black/40" />

      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
        <div className="relative w-[85%] aspect-[3/5] rounded-2xl shadow-[0_0_0_9999px_rgba(16,22,34,0.75)]">
          <div className="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-app-primary" />
          <div className="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-app-primary" />
          <div className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-app-primary" />
          <div className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-app-primary" />
          <div className="absolute left-3 right-3 top-1/2 h-0.5 -translate-y-1/2 bg-app-primary/60 shadow-[0_0_15px_rgba(19,91,236,0.9)]" />
        </div>
        <div className="mt-6 rounded-full border border-white/10 bg-black/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/90">
          Align receipt within frame
        </div>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col justify-between">
        <div className="flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-6 pb-4 pt-12">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/5 bg-white/10 text-white backdrop-blur"
            onClick={() => {
              if (isCameraOpen) stopCamera();
              if (onTabChange) onTabChange('receipts');
            }}
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80">
            Scanner Ready
          </span>
          <button
            type="button"
            onClick={handleToggleFlash}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/5 backdrop-blur ${
              isFlashOn ? 'bg-app-primary text-white' : 'bg-white/10 text-white/80'
            }`}
            aria-label="Flash"
          >
            <Zap className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1" />

        <div className="rounded-t-3xl bg-gradient-to-t from-app-bg via-app-bg/95 to-transparent px-6 pb-8 pt-12">
          <div className="flex justify-center">
            <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur">
              <button
                type="button"
                onClick={() => setScanMode('single')}
                className={`rounded-lg px-4 py-2 text-xs font-bold shadow-sm ${
                  scanMode === 'single' ? 'bg-app-primary text-white' : 'text-slate-400'
                }`}
              >
                Single Scan
              </button>
              <button
                type="button"
                onClick={() => setScanMode('batch')}
                className={`px-4 py-2 text-xs font-semibold ${
                  scanMode === 'batch' ? 'rounded-lg bg-app-primary text-white' : 'text-slate-400'
                }`}
              >
                Batch Mode
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
              aria-label="Upload image"
            >
              <Image className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (isCameraOpen && isCameraReady) {
                  capturePhoto();
                } else {
                  handleOpenCamera();
                }
              }}
              className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white shadow-xl"
              aria-label="Capture"
            >
              <span className="absolute inset-1 rounded-full bg-app-primary shadow-inner" />
              <Camera className="relative h-6 w-6 text-white" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (isCameraOpen) stopCamera();
                handleManualEntry();
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
              aria-label="Enter manually"
            >
              <Edit className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 text-center text-xs text-slate-400">
            Or{' '}
            <button
              type="button"
              onClick={() => {
                if (isCameraOpen) stopCamera();
                handleManualEntry();
              }}
              className="text-app-primary underline"
            >
              enter details manually
            </button>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setGroupSwitcherOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300"
            >
              <span className="max-w-[120px] truncate">
                {selectedGroup ? selectedGroup.name : "Group"}
              </span>
              <Users className="h-4 w-4 text-app-primary" />
            </button>
          </div>

          {groupSwitcherOpen && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/60 p-3">
              <div className="mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Select group
              </div>
              <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                {groups.length === 0 ? (
                  <div className="text-xs text-slate-500">No groups available.</div>
                ) : (
                  groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setGroupSwitcherOpen(false);
                      }}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white hover:border-white/30"
                    >
                      <span className="truncate">{group.name}</span>
                      {selectedGroupId === group.id && (
                        <span className="text-xs text-app-primary">Selected</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <input
        type="file"
        id="fileInput"
        ref={fileInputRef}
        onChange={handleImageChange}
        accept="image/*"
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
}
