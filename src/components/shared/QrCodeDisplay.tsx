
'use client';

import React from 'react';
import QRCodeStyling, { type Options as QRCodeStylingOptions, type DotType, type CornerSquareType, type CornerDotType } from 'qr-code-styling';
import { Button } from '@/components/ui/button';
import { Copy, Download, Check, Settings2, Loader2 } from 'lucide-react'; // Added Loader2
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const dotTypes: DotType[] = ["rounded", "dots", "classy", "classy-rounded", "square", "extra-rounded"];
const cornerSquareTypes: CornerSquareType[] = ["dot", "square", "extra-rounded"];
const cornerDotTypes: CornerDotType[] = ["dot", "square"];

interface QrCodeDisplayProps {
  value: string;
  initialSize?: number;
  downloadFileName?: string;
  eventLogoUrl?: string;
}

interface QrStylingState {
  size: number;
  dotsColor: string;
  backgroundColor: string;
  cornersSquareColor: string;
  cornersDotColor: string;
  dotsType: DotType;
  cornersSquareType: CornerSquareType;
  cornersDotType: CornerDotType;
  image?: string;
}

export const QrCodeDisplay: React.FC<QrCodeDisplayProps> = ({
  value,
  initialSize = 180,
  downloadFileName = 'harmun-checkin-qr.png',
  eventLogoUrl,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const [qrInstance, setQrInstance] = React.useState<QRCodeStyling | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  const [styling, setStyling] = React.useState<QrStylingState>({
    size: initialSize,
    dotsColor: '#000000',
    backgroundColor: '#FFFFFF',
    cornersSquareColor: '#000000',
    cornersDotColor: '#000000',
    dotsType: 'rounded',
    cornersSquareType: 'extra-rounded',
    cornersDotType: 'dot',
    image: eventLogoUrl || undefined,
  });

  const [qrOptions, setQrOptions] = React.useState<QRCodeStylingOptions | null>(null);

  // Effect to update styling based on props (size, eventLogoUrl)
  React.useEffect(() => {
    setStyling(prev => ({
      ...prev,
      size: initialSize,
      image: eventLogoUrl || undefined,
    }));
  }, [initialSize, eventLogoUrl]);

  // Effect to build QR options once theme and styling are stable
  React.useEffect(() => {
    if (resolvedTheme) { // Only build options when theme is known
      const currentDotsColor = resolvedTheme === 'dark' ? '#A5D6A7' : '#2E7D32';
      const currentBackgroundColor = resolvedTheme === 'dark' ? '#263238' : '#FFFFFF';
      const currentCornersSquareColor = resolvedTheme === 'dark' ? '#64B5F6' : '#1976D2';
      const currentCornersDotColor = resolvedTheme === 'dark' ? '#81C784' : '#388E3C';

      const options: QRCodeStylingOptions = {
        width: styling.size,
        height: styling.size,
        margin: 10,
        qrOptions: { typeNumber: 0, mode: 'Byte', errorCorrectionLevel: 'H' },
        imageOptions: { hideBackgroundDots: true, imageSize: 0.35, margin: 8, crossOrigin: 'anonymous' },
        dotsOptions: { type: styling.dotsType, color: styling.dotsColor !== '#000000' ? styling.dotsColor : currentDotsColor },
        backgroundOptions: { color: styling.backgroundColor !== '#FFFFFF' ? styling.backgroundColor : currentBackgroundColor },
        cornersSquareOptions: { type: styling.cornersSquareType, color: styling.cornersSquareColor !== '#000000' ? styling.cornersSquareColor : currentCornersSquareColor },
        cornersDotOptions: { type: styling.cornersDotType, color: styling.cornersDotColor !== '#000000' ? styling.cornersDotColor : currentCornersDotColor },
        data: value,
        image: styling.image || undefined,
      };
      setQrOptions(options);
    } else {
      setQrOptions(null); // Reset if theme is not resolved
    }
  }, [resolvedTheme, styling, value]);


  // Effect to render QR code when options are ready
  React.useEffect(() => {
    if (qrOptions && ref.current && typeof window !== 'undefined') {
      const newQrCodeInstance = new QRCodeStyling(qrOptions);
      setQrInstance(newQrCodeInstance); // Store instance for download
      
      // Clear previous QR code and append new one
      ref.current.innerHTML = ''; 
      newQrCodeInstance.append(ref.current);
    } else if (ref.current) {
      ref.current.innerHTML = ''; // Clear if no options (e.g., theme not resolved yet)
    }
  }, [qrOptions]);


  const handleDownload = () => {
    if (qrInstance) {
      qrInstance.download({ name: downloadFileName, extension: 'png' });
      toast({ title: 'QR Code Downloading', description: `${downloadFileName} will be saved.` });
    } else {
      toast({ title: 'Error', description: 'QR code not ready for download.', variant: 'destructive'});
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast({ title: 'Link Copied!', description: 'Check-in link copied to clipboard.' });
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      toast({ title: 'Copy Failed', description: 'Could not copy link.', variant: 'destructive' });
      console.error('Failed to copy link: ', err);
    });
  };

  const handleStylingChange = (field: keyof QrStylingState, val: string | number | DotType | CornerSquareType | CornerDotType) => {
    setStyling(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 border rounded-xl shadow-lg bg-card hover:shadow-xl transition-shadow duration-300 relative">
      <div 
        ref={ref} 
        style={{ width: styling.size, height: styling.size, overflow: 'hidden' }} 
        className="rounded-lg border-2 border-primary/20 flex items-center justify-center bg-muted"
        aria-label={`QR code for link: ${value}`}
        role="img"
      >
        {!resolvedTheme && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />} 
      </div>
      <div className="flex items-center justify-center gap-2 mt-3 w-full">
        <Button onClick={handleCopyLink} variant="outline" size="sm" className="flex-1">
          {copied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy Link'}
        </Button>
        <Button onClick={handleDownload} variant="outline" size="sm" className="flex-1">
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Customize QR Code">
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Customize QR Code</h4>
              <p className="text-sm text-muted-foreground">
                Adjust the appearance of this QR code.
              </p>
            </div>
            <Separator />
            <div className="grid gap-3">
              <div className="grid grid-cols-3 items-center gap-2">
                <Label htmlFor="qr-size">Size (px)</Label>
                <Input
                  id="qr-size"
                  type="number"
                  value={styling.size} 
                  onChange={(e) => handleStylingChange('size', parseInt(e.target.value, 10) || 100)}
                  className="col-span-2 h-8"
                  min="50"
                  max="500"
                  step="10"
                />
              </div>
               <div className="grid grid-cols-3 items-center gap-2">
                <Label htmlFor="qr-dotsColor">Dots Color</Label>
                <Input
                  id="qr-dotsColor"
                  type="color"
                  value={styling.dotsColor} 
                  onChange={(e) => handleStylingChange('dotsColor', e.target.value)}
                  className="col-span-2 h-8 p-0.5"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <Label htmlFor="qr-backgroundColor">Background</Label>
                <Input
                  id="qr-backgroundColor"
                  type="color"
                  value={styling.backgroundColor} 
                  onChange={(e) => handleStylingChange('backgroundColor', e.target.value)}
                  className="col-span-2 h-8 p-0.5"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <Label htmlFor="qr-dotsType">Dots Style</Label>
                <Select
                  value={styling.dotsType}
                  onValueChange={(v) => handleStylingChange('dotsType', v as DotType)}
                >
                  <SelectTrigger className="col-span-2 h-8">
                    <SelectValue placeholder="Select dots style" />
                  </SelectTrigger>
                  <SelectContent>
                    {dotTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
               <div className="grid grid-cols-3 items-center gap-2">
                <Label htmlFor="qr-image">Logo URL</Label>
                <Input
                  id="qr-image"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={styling.image || ''} 
                  onChange={(e) => handleStylingChange('image', e.target.value)}
                  className="col-span-2 h-8"
                />
              </div>
            </div>
            <Button onClick={() => setIsPopoverOpen(false)} className="w-full" size="sm">Apply & Close</Button>
          </PopoverContent>
        </Popover>
      </div>
       <p className="text-xs text-muted-foreground break-all max-w-[calc(100%-1rem)] text-center mt-1">
        Link: <span className="font-mono">{value.length > 30 ? value.substring(0,27) + '...' : value}</span>
      </p>
    </div>
  );
};
