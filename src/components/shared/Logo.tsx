
import { Users } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'circled-icon';
  className?: string;
  customLogoUrl?: string | null;
}

export function Logo({ size = 'md', variant = 'default', className, customLogoUrl }: LogoProps) {
  const textSizeClasses = size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl';
  const iconSizeClasses = size === 'sm' ? 'h-5 w-5' : size === 'md' ? 'h-6 w-6' : 'h-7 w-7';
  
  const iconBaseClasses = `text-primary group-hover:text-primary/90 transition-colors`;
  const textBaseClasses = `font-semibold ${textSizeClasses} text-foreground group-hover:text-foreground/90 transition-colors`;
  
  // Define max height for custom logo based on size prop
  const logoImageMaxHeight = size === 'sm' ? 'max-h-8' : size === 'md' ? 'max-h-10' : 'max-h-12'; // 32px, 40px, 48px

  if (customLogoUrl) {
    return (
      <Link href="/" className={cn("flex items-center gap-2 group", className)}>
        <Image
          src={customLogoUrl}
          alt="MUN Conference Logo"
          width={variant === 'circled-icon' ? (size === 'sm' ? 28 : (size === 'md' ? 32 : 36)) : 120} // Adjust width based on variant/size
          height={variant === 'circled-icon' ? (size === 'sm' ? 28 : (size === 'md' ? 32 : 36)) : 40}
          className={cn(
            "object-contain", 
            logoImageMaxHeight,
            variant === 'circled-icon' && "rounded-full p-0.5 bg-muted group-hover:bg-accent/80"
          )}
          priority // Consider adding priority if it's LCP, otherwise remove
        />
        {/* Optionally, show text next to custom image logo if not circled-icon variant */}
        {variant !== 'circled-icon' && (
           <h1 className={textBaseClasses} style={{ lineHeight: '1' }}> 
             {/* Text can be hidden or shown based on design preference when custom logo is active */}
             {/* MUN Tracker */} 
           </h1>
        )}
      </Link>
    );
  }

  // Fallback to default icon + text logo
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

    