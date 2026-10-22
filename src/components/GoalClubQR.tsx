import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Download, QrCode } from 'lucide-react';

interface GoalClubQRProps {
  url?: string;
  size?: number;
  showDownload?: boolean;
  className?: string;
}

/**
 * Renders a high-resolution QR code that points to the Målklubben signup page.
 * Used both publicly (so visitors can share with phones) and in admin (for posters).
 */
const GoalClubQR = ({
  url = 'https://fagerborgbk.no/malklubben',
  size = 240,
  showDownload = true,
  className = '',
}: GoalClubQRProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0a1f44', // fagerborg navy
        light: '#ffffff',
      },
    });
    QRCode.toDataURL(url, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#0a1f44', light: '#ffffff' },
    }).then(setDataUrl);
  }, [url, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'fagerborg-malklubben-qr.png';
    a.click();
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="bg-white p-3 rounded-xl shadow-md">
        <canvas ref={canvasRef} aria-label="QR-kode til Målklubben" />
      </div>
      {showDownload && (
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={!dataUrl}>
          <Download className="h-4 w-4 mr-2" />
          Last ned QR-kode
        </Button>
      )}
    </div>
  );
};

export { GoalClubQR };
export default GoalClubQR;