interface UserAvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
}

export const UserAvatar = ({ src, name = '', size = 40 }: UserAvatarProps) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className="flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold overflow-hidden"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials || '?'
      )}
    </div>
  );
};
