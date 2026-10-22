import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock, Users } from 'lucide-react';

interface VippsPaywallProps {
  matchId: string;
  onBack?: () => void;
}

/**
 * Non-members cannot unlock the stream themselves. Access is granted only by the
 * server after member verification, so this screen just explains how to get in
 * and invites a voluntary donation.
 */
const VippsPaywall = ({ onBack }: VippsPaywallProps) => {
  return (
    <div className="max-w-lg mx-auto text-center py-12 px-4">
      <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50">
        <Lock className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h2 className="text-2xl font-bold mb-2">Se direktesendingen</h2>

        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-3">
            Direktesendingene er forbeholdt medlemmer. Bli medlem og få full tilgang til alle
            sendinger og eksklusivt innhold.
          </p>
          <Button asChild size="lg" className="w-full gap-2">
            <Link to="/bli-medlem">
              <Users className="w-4 h-4" />
              Bli medlem
            </Link>
          </Button>
        </div>

        <div className="pt-6 border-t border-border/50">
          <p className="text-muted-foreground text-sm">
            Vil du støtte sendingene? Vipps gjerne en symbolsk sum til{' '}
            <strong>#12220</strong> (Fagerborg BK). Alle pengene går uavkortet til å drifte
            direktesendingene.
          </p>
        </div>

        {onBack && (
          <div className="pt-6">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Tilbake – jeg er medlem
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VippsPaywall;
