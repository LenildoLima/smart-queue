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
      <div className="bg-gradient-to-br from-[#7c6aff] to-[#00d4aa] rounded-lg p-2">
        <Users className="text-white" size={s.icon} />
      </div>
      <span className={`${s.text} font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#7c6aff] to-[#00d4aa] font-[Syne]`}>
        SmartQueue
      </span>
    </div>
  );
};
