import { SmartQueueLogo } from '@/components/SmartQueueLogo';
import { Clock } from 'lucide-react';

const ComingSoon = ({ title = 'Em breve' }: { title?: string }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-6">
    <SmartQueueLogo size="lg" />
    <div className="flex items-center gap-3 text-muted-foreground">
      <Clock size={24} />
      <span className="text-xl font-medium">{title}</span>
    </div>
  </div>
);

export default ComingSoon;
