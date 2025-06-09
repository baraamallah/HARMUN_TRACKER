
import { Users } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import * as React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'circled-icon';
  className?: string;
}

export function Logo({ size = 'md', variant = 'default', className }: LogoProps) {
  const textSizeClasses = size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl';
  const iconSizeClasses = size === 'sm' ? 'h-5 w-5' : size === 'md' ? 'h-6 w-6' : 'h-7 w-7';
  
  const iconBaseClasses = `text-primary group-hover:text-primary/90 transition-colors`;
  const textBaseClasses = `font-semibold ${textSizeClasses} text-foreground group-hover:text-foreground/90 transition-colors`;
  
  if (variant === 'circled-icon') {
    return (
      <Link href="/" className={cn("flex items-center gap-2 group", className)}>
        <div className="p-1.5 rounded-full bg-muted group-hover:bg-accent/80 transition-colors">
          <Users className={cn(iconSizeClasses, 'text-primary group-hover:text-accent-foreground transition-colors')} />
        </div>
        <h1 className={textBaseClasses}>
          MUN Tracker
        </h1>
      </Link>
    );
  }

  return (
    <Link href="/" className={cn("flex items-center gap-2 group", className)}>
      <Users className={cn(iconBaseClasses, iconSizeClasses)} />
      <h1 className={textBaseClasses}>
        MUN Tracker
      </h1>
    </Link>
  );
}
