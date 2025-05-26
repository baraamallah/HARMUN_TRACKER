import { Users } from 'lucide-react';
import Link from 'next/link';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const textSize = size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl';
  const iconSize = size === 'sm' ? 5 : size === 'md' ? 6 : 7;

  return (
    <Link href="/" className="flex items-center gap-2 group">
      <Users className={`h-${iconSize} w-${iconSize} text-primary group-hover:text-primary/80 transition-colors`} />
      <h1 className={`font-semibold ${textSize} text-foreground group-hover:text-foreground/80 transition-colors`}>
        MUN Tracker
      </h1>
    </Link>
  );
}
