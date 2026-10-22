import { Link } from 'react-router-dom';
import { Facebook, Instagram, Youtube, LogIn, Heart, ExternalLink } from 'lucide-react';






// TikTok icon (not in lucide)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.88a8.28 8.28 0 004.76 1.49V6.92a4.84 4.84 0 01-1-.23z" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
import fagerborgLogo from '@/assets/fagerborg-logo.png';
import vippsLogo from '@/assets/vipps-logo.png';

import { useGrasrotDirect, formatNOKWithDecimals } from '@/hooks/useGrasrotDirect';
import { useSiteSetting } from '@/hooks/useSiteSettings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

const GrasrotSparkline = ({ data }: { data: { year: string; amount: number }[] }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  
  if (data.length < 2) return null;

  const amounts = data.map(d => d.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const range = max - min || 1;

  const w = 600;
  const h = 64;
  const pad = 2;

  const coords = data.map((d, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - ((d.amount - min) / range) * (h - pad * 2),
  }));

  const points = coords.map(c => `${c.x},${c.y}`);

  return (
    <div className="mt-2 mb-1 w-full relative">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${pad},${h - pad} ${points.join(' ')} ${w - pad},${h - pad}`}
          fill="url(#sparkFill)"
        />
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Hover dot */}
        {hoverIndex !== null && (
          <circle
            cx={coords[hoverIndex].x}
            cy={coords[hoverIndex].y}
            r="4"
            fill="hsl(var(--secondary))"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {/* Invisible hit areas */}
        {coords.map((c, i) => (
          <rect
            key={i}
            x={c.x - w / data.length / 2}
            y={0}
            width={w / data.length}
            height={h}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
          />
        ))}
      </svg>
      {/* Tooltip */}
      {hoverIndex !== null && (
        <div
          className="absolute -top-8 bg-popover text-popover-foreground text-[11px] font-medium px-2 py-1 rounded shadow-md border border-border whitespace-nowrap pointer-events-none"
          style={{ left: `${(coords[hoverIndex].x / w) * 100}%`, transform: 'translateX(-50%)' }}
        >
          {data[hoverIndex].year}: {data[hoverIndex].amount.toLocaleString('nb-NO')} kr
        </div>
      )}
      <div className="flex justify-between text-[10px] text-white/40 mt-0.5">
        <span>{data[0].year}</span>
        <span>{data[data.length - 1].year}</span>
      </div>
    </div>
  );
};

const GrasrotFooterWidget = () => {
  const { data } = useGrasrotDirect();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());

  const selectedYearData = data?.yearlyData?.find(d => d.year === parseInt(selectedYear));
  const allYears = data?.yearlyData
    ?.filter(d => d.amount_nok > 0)
    .sort((a, b) => b.year - a.year) || [];

  const lastCompletedYear = currentYear - 1;
  const chartData = data?.yearlyData
    ?.filter(d => d.amount_nok > 0 && d.year <= lastCompletedYear)
    .sort((a, b) => a.year - b.year)
    .slice(-10)
    .map(d => ({
      year: d.year.toString(),
      amount: Math.round(d.amount_nok),
    })) || [];

  if (!data?.yearlyData || data.yearlyData.length === 0) return null;

  return (
    <div>
      <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-white">
        <Heart className="w-4 h-4 text-red-400" />
        Grasrotandelen
      </h4>

      <div className="flex items-center gap-3 mb-2">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[100px] h-8 text-xs bg-white/15 border-white/30 text-white hover:bg-white/20 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allYears.map(d => (
              <SelectItem key={d.year} value={d.year.toString()}>
                {d.year}{d.year === currentYear ? ' (i år)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-lg font-bold text-secondary">
          {selectedYearData ? formatNOKWithDecimals(selectedYearData.amount_nok) : '—'}
        </span>
      </div>

      <GrasrotSparkline data={chartData} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <a
          href="https://www.norsk-tipping.no/grasrotandelen/din-mottaker/996145530"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-secondary/80 transition-colors"
        >
          Velg oss som mottaker <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href="https://www.norsk-tipping.no/grasrotandelen"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white/80 transition-colors"
        >
          Les mer <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
const MobileGrasrotCTA = () => {
  const { data } = useGrasrotDirect();
  const currentYear = new Date().getFullYear();
  const allYears = data?.yearlyData
    ?.filter(d => d.amount_nok > 0)
    .sort((a, b) => b.year - a.year) || [];
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const selectedYearData = allYears.find(d => d.year === parseInt(selectedYear));

  return (
    <div className="lg:hidden mt-3">
      <a
        href="https://www.norsk-tipping.no/grasrotandelen/din-mottaker/996145530"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-colors px-4 py-2.5 rounded-full"
        aria-label="Velg Fagerborg BK som grasrotmottaker"
      >
        <Heart className="w-5 h-5 text-red-400" />
        <span className="text-white text-sm font-semibold">Velg oss som grasrotmottaker</span>
      </a>
      {allYears.length > 0 && (
        <div className="flex items-center gap-3 mt-2 ml-1">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[90px] h-7 text-xs bg-white/15 border-white/30 text-white hover:bg-white/20 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allYears.map(d => (
                <SelectItem key={d.year} value={d.year.toString()}>
                  {d.year}{d.year === currentYear ? ' (i år)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-bold text-secondary">
            {selectedYearData ? formatNOKWithDecimals(selectedYearData.amount_nok) : '—'}
          </span>
        </div>
      )}
    </div>
  );
};

const Footer = () => {
  const { value: showPortals } = useSiteSetting('show_portals');
  const portalsVisible = showPortals !== false;

  const { value: goalClubEnabled } = useSiteSetting('goal_club_enabled');

  const footerLinks: Record<string, Array<{ label: string; href: string; external?: boolean }>> = {
    'Om Klubben': [
      { label: 'Historie', href: '/om-klubben' },
      { label: 'Styret', href: '/styret' },
      { label: 'Kontakt oss', href: '/kontakt' },
      { label: 'Bli partner', href: '/bli-partner' },
      { label: 'Bli medlem', href: '/bli-medlem' },
      { label: 'Målklubben', href: '/malklubben' },
    ],
    'Lag': [
      { label: 'A-laget', href: '/spillerstall' },
      { label: 'B-laget', href: '/spillerstall?lag=B-laget' },
    ],
  };

  if (portalsVisible) {
    footerLinks['Klubbportaler'] = [
      { label: 'Spillerportal', href: 'https://spiller.fagerborgbk.no', external: true },
      { label: 'Trenerportal', href: 'https://trener.fagerborgbk.no', external: true },
    ];
  }

  const socialLinks = [
    { icon: Facebook, href: 'https://www.facebook.com/profile.php?id=61587527156113', label: 'Facebook' },
    { icon: Instagram, href: 'https://www.instagram.com/fagerborg_bk/', label: 'Instagram' },
    { icon: Youtube, href: 'https://www.youtube.com/@FagerborgBK', label: 'YouTube' },
    { icon: TikTokIcon, href: 'https://www.tiktok.com/@fagerborgbk', label: 'TikTok' },
    { icon: XIcon, href: 'https://x.com/fagerborgbk', label: 'X (Twitter)' },
  ];

  return (
    <footer className="bg-fagerborg-navy text-white" id="klubben">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 items-start">
          {/* Club Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-4 mb-6">
              <img 
                src={fagerborgLogo} 
                alt="Fagerborg BK" 
                className="w-20 h-20"
              />
            </div>
            <h3 className="font-bold text-xl mb-2">Fagerborg BK</h3>
            <address className="not-italic text-white/70 leading-relaxed mb-6">
              Fagerborggata 50 A<br />
              0360 Oslo<br />
              Norge
            </address>
            <div className="text-white/70 text-sm space-y-1">
              <p><strong className="text-white">Org.nr:</strong> 996 145 530</p>
              <p><strong className="text-white">Stiftet:</strong> 1914</p>
              <p><strong className="text-white">E-post:</strong> post@fagerborgbk.no</p>
            </div>

            {/* Social Links */}
            <div className="flex gap-4 mt-6 flex-wrap">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-white/10 hover:bg-secondary hover:text-secondary-foreground rounded-full flex items-center justify-center transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>

            {/* Vipps */}
            <a
              href="https://qr.vipps.no/28/2/05/031/4699473820"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-colors px-4 py-2.5 rounded-full"
              aria-label="Støtt Fagerborg BK på Vipps"
            >
              <img src={vippsLogo} alt="Vipps" className="h-6 w-6 rounded-full" />
              <span className="text-white text-sm font-semibold">Støtt Fagerborg BK — <span className="font-bold">#12220</span></span>
            </a>

            {/* Grasrot CTA – mobile/tablet only (full widget is hidden) */}
            <MobileGrasrotCTA />
          </div>

          {/* Right side: link columns stacked with grasrot below */}
          <div className="lg:col-span-3">
            <div className={`grid grid-cols-2 ${portalsVisible ? 'sm:grid-cols-3' : 'grid-cols-2'} gap-8`}>
              {Object.entries(footerLinks).map(([title, links]) => (
                <div key={title}>
                  <h4 className="font-bold text-lg mb-4">{title}</h4>
                  <ul className="space-y-3">
                    {links.map((link) => (
                      <li key={link.label}>
                        {'external' in link && link.external ? (
                          <a 
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white/70 hover:text-secondary transition-colors"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link 
                            to={link.href}
                            className="text-white/70 hover:text-secondary transition-colors"
                          >
                            {link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Grasrotandelen – below link columns, aligned with them */}
            <div className="hidden lg:block mt-8 pt-6 border-t border-white/10">
              <GrasrotFooterWidget />
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-white/50">
            <p>© {new Date().getFullYear()} Fagerborg BK. Alle rettigheter reservert.</p>
            <div className="flex gap-6">
              <Link to="/personvern" className="hover:text-white transition-colors">Personvern</Link>
              <Link to="/vilkar" className="hover:text-white transition-colors">Vilkår</Link>
              <Link to="/auth" className="hover:text-white transition-colors inline-flex items-center gap-1">
                <LogIn className="w-3 h-3" />
                Admin
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
