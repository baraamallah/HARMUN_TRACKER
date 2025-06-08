
import { Users } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import * as React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'circled-icon';
  className?: string;
  customLogoUrl?: string | null;
}

const LOCAL_SVG_LOGO_PATH = "/mun-logo.svg"; // The path to your local SVG in the /public folder

export function Logo({ size = 'md', variant = 'default', className, customLogoUrl }: LogoProps) {
  const textSizeClasses = size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl';
  const iconSizeClasses = size === 'sm' ? 'h-5 w-5' : size === 'md' ? 'h-6 w-6' : 'h-7 w-7';
  
  const iconBaseClasses = `text-primary group-hover:text-primary/90 transition-colors`;
  const textBaseClasses = `font-semibold ${textSizeClasses} text-foreground group-hover:text-foreground/90 transition-colors`;
  
  const logoImageMaxHeight = size === 'sm' ? 'max-h-8' : size === 'md' ? 'max-h-10' : 'max-h-12'; // 32px, 40px, 48px
  const [localLogoExists, setLocalLogoExists] = React.useState(false);
  const [checkingLocalLogo, setCheckingLocalLogo] = React.useState(true);

  React.useEffect(() => {
    // Only check for local logo if no custom URL is provided
    if (customLogoUrl === undefined || customLogoUrl === null || customLogoUrl === '') {
      fetch(LOCAL_SVG_LOGO_PATH)
        .then(res => {
          if (res.ok) {
            // Check content type to be reasonably sure it's an SVG
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("svg")) {
              setLocalLogoExists(true);
            } else {
              setLocalLogoExists(false);
              console.warn(`Local logo file found at ${LOCAL_SVG_LOGO_PATH}, but it might not be an SVG. Content-Type: ${contentType}`);
            }
          } else {
            setLocalLogoExists(false);
          }
        })
        .catch(() => setLocalLogoExists(false))
        .finally(() => setCheckingLocalLogo(false));
    } else {
      setCheckingLocalLogo(false); // No need to check if custom URL is present
    }
  }, [customLogoUrl]);


  // Determine logo source
  let logoSrcToUse = customLogoUrl;
  let isLocalSvg = false;

  if (!customLogoUrl && !checkingLocalLogo && localLogoExists) {
    logoSrcToUse = LOCAL_SVG_LOGO_PATH;
    isLocalSvg = true;
  }

  if (logoSrcToUse) {
    return (
      <Link href="/" className={cn("flex items-center gap-2 group", className)}>
        <Image
          src={logoSrcToUse}
          alt="MUN Conference Logo"
          width={variant === 'circled-icon' ? (size === 'sm' ? 28 : (size === 'md' ? 32 : 36)) : (isLocalSvg ? 40 : 120) } // Smaller width for local SVG default
          height={variant === 'circled-icon' ? (size === 'sm' ? 28 : (size === 'md' ? 32 : 36)) : 40}
          className={cn(
            "object-contain", 
            logoImageMaxHeight,
            variant === 'circled-icon' && "rounded-full p-0.5 bg-muted group-hover:bg-accent/80"
          )}
          priority={isLocalSvg} // Prioritize if it's the local SVG as it's part of the initial layout
          data-ai-hint="logo company"
        />
        {(variant !== 'circled-icon' && !isLocalSvg) && ( // Only show "MUN Tracker" text if it's a remote URL and not circled
           <h1 className={textBaseClasses} style={{ lineHeight: '1' }}> 
             {/* MUN Tracker */} 
           </h1>
        )}
         {(variant !== 'circled-icon' && isLocalSvg) && ( // Optionally, show text next to local SVG
           <h1 className={textBaseClasses} style={{ lineHeight: '1' }}> 
             MUN Tracker
           </h1>
        )}
      </Link>
    );
  }

  // Fallback to default icon + text logo if no custom URL and no local SVG or still checking
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
