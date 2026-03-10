import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ size = 32 }: { size?: number }) => (
  <Loader2 className="animate-spin text-primary" style={{ width: size, height: size }} />
);
