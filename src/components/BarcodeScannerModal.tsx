import { useEffect, useRef, useState } from 'react';
import { Camera, X, ScanBarcode } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): {
    detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
  };
}

export function BarcodeScannerModal({ isOpen, onClose, onDetected }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let stream: MediaStream | null = null;
    let cancelled = false;
    let rafId = 0;

    async function startScanner() {
      setError('');
      setCameraActive(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access is not available in this browser context. Enter barcode manually below or use a USB scanner.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);
        }

        const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        if (!Detector) {
          setError('Live camera preview is active, but native BarcodeDetector is not supported by this browser. Use a USB scanner or type the barcode below.');
          return;
        }

        const detector = new Detector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
        });

        const scanLoop = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            if (videoRef.current.readyState >= 2) {
              const results = await detector.detect(videoRef.current);
              const first = results.find((r) => r.rawValue && r.rawValue.trim().length > 0);
              if (first?.rawValue) {
                onDetected(first.rawValue.trim());
                onClose();
                return;
              }
            }
          } catch {
            // Ignore frame decode glitches
          }
          rafId = requestAnimationFrame(scanLoop);
        };
        rafId = requestAnimationFrame(scanLoop);
      } catch (err) {
        setError(
          err instanceof Error
            ? `Camera unavailable (${err.message}). Enter barcode manually or use USB scanner.`
            : 'Unable to open camera. Enter barcode manually.'
        );
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, onClose, onDetected]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 font-display font-semibold text-slate-900 dark:text-slate-100">
            <Camera className="w-4 h-4 text-emerald-600" />
            <span>Barcode Scanner</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative aspect-video w-full rounded-lg bg-slate-900 overflow-hidden flex items-center justify-center border border-slate-800">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4 text-center text-xs">
                <ScanBarcode className="w-8 h-8 mb-2 text-emerald-500" />
                <span>Initializing camera viewfinder...</span>
              </div>
            )}
            {cameraActive && (
              <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-500/80" />
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualCode.trim()) return;
              onDetected(manualCode.trim());
              setManualCode('');
              onClose();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or type / scan barcode here..."
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium whitespace-nowrap"
            >
              Add Item
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
