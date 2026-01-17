import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import ReceiptUploader from '@/components/receipts/ReceiptUploader';

const mockToast = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/contexts/LoadingContext', () => ({
  useLoading: () => ({ isLoading: false, setIsLoading: vi.fn() }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
  Timestamp: {},
}));

describe('ReceiptUploader camera flow', () => {
  beforeEach(() => {
    mockToast.mockClear();
    const track = {
      getCapabilities: () => ({ torch: true }),
      applyConstraints: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      enabled: true,
    };
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    };
    globalThis.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(stream),
    };
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the camera feed when capture is pressed', async () => {
    const { container } = render(<ReceiptUploader showOnly="upload" />);
    const captureButton = container.querySelector('[aria-label="Capture"]');
    expect(captureButton).toBeTruthy();

    fireEvent.click(captureButton);

    await waitFor(() => {
      expect(globalThis.navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    const video = container.querySelector('video');
    expect(video).toBeTruthy();

    video.dispatchEvent(new Event('loadedmetadata'));
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });
  });

  it('queues a flash toggle when pressed before the camera is ready', async () => {
    const { container } = render(<ReceiptUploader showOnly="upload" />);
    const flashButton = container.querySelector('[aria-label="Flash"]');
    expect(flashButton).toBeTruthy();

    fireEvent.click(flashButton);

    await waitFor(() => {
      expect(globalThis.navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    video.dispatchEvent(new Event('loadedmetadata'));

    await waitFor(() => {
      const stream = video.srcObject;
      const [track] = stream.getVideoTracks();
      expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    });
  });
});
