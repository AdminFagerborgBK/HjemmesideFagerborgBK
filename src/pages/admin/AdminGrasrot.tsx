import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sprout } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import GrasrotPosterGenerator from '@/components/admin/GrasrotPosterGenerator';

const ORG_NUMBER = '996145530';
const QR_URL = `https://www.norsk-tipping.no/grasrotandelen/din-mottaker/${ORG_NUMBER}`;

const AdminGrasrot = () => {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(QR_URL, {
      width: 600,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: '#0a1f44', light: '#ffffff' },
    }).then(setQrUrl);
  }, []);

  const downloadQr = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = 'fagerborg-grasrot-qr.png';
    a.click();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sprout className="h-6 w-6" />
            Grasrotandelen
          </h1>
          <p className="text-muted-foreground">
            Lag plakater og QR-koder for å rekruttere nye grasrotgivere til Fagerborg BK.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sprout className="h-5 w-5" />
                QR-kode til Grasrotandelen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                QR-koden peker direkte til Fagerborg BK (org.nr {ORG_NUMBER}) på Norsk Tipping sine sider.
              </p>
              {qrUrl && (
                <div className="flex justify-center bg-muted rounded-lg p-4">
                  <img src={qrUrl} alt="Grasrot QR" className="w-48 h-48" />
                </div>
              )}
              <Button onClick={downloadQr} className="w-full" variant="outline">
                <Download className="h-4 w-4 mr-2" /> Last ned QR-kode
              </Button>
            </CardContent>
          </Card>
          <div className="lg:col-span-2">
            <GrasrotPosterGenerator />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminGrasrot;