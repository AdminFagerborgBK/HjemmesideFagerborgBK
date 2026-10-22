import { ReactNode } from 'react';
import { useSiteSetting } from '@/hooks/useSiteSettings';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * FeatureGate - Conditionally renders children based on feature flags in site_settings
 * Used to hide/show features like sponsors based on admin settings
 */
export const FeatureGate = ({ feature, children, fallback = null }: FeatureGateProps) => {
  const { value, isLoading } = useSiteSetting(feature);

  // While loading, don't render anything to avoid flash
  if (isLoading) {
    return null;
  }

  // If feature is enabled (value is true), render children
  if (value === true) {
    return <>{children}</>;
  }

  // Otherwise render fallback (default: nothing)
  return <>{fallback}</>;
};

