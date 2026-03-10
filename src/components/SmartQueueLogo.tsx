import { Users } from 'lucide-react';

export const SmartQueueLogo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = {
    sm: { icon: 20, text: 'text-lg' },
    md: { icon: 28, text: 'text-2xl' },
    lg: { icon: 36, text: 'text-3xl' },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2">
      <div className="gradient-primary rounded-lg p-2">
        <Users className="text-primary-foreground" size={s.icon} />
      </div>
      <span className={`${s.text} font-bold text-primary`}>SmartQueue</span>
    </div>
  );
};
