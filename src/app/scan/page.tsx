
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode, type Html5QrcodeError, type Html5QrcodeResult, type Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CameraOff, AlertTriangle, ArrowLeft, ScanLine } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';

const QR_SCANNER_ELEMENT_ID = "qr-reader-preview";

export default function ScanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const requestRef = useRef<number>();


  const startScanner = useCallback(async () => {
    if (!html5QrCodeRef.current || isScannerActive) return;

    setIsLoading(true);
    setScanError(null);
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length) {
        const backCameras = cameras.filter(camera => camera.label.toLowerCase().includes('back'));
        const cameraId = backCameras.length > 0 ? backCameras[0].id : cameras[0].id;
        
        const qrboxFunction = (viewportWidth: number, viewportHeight: number) => {
            const minEdge = Math.min(viewportWidth, viewportHeight);
            const qrboxSize = Math.max(250, Math.floor(minEdge * 0.7)); // Ensure minimum size
            return { width: qrboxSize, height: qrboxSize };
        };

        const config: Html5QrcodeCameraScanConfig = {
          fps: 10,
          qrbox: qrboxFunction,
          aspectRatio: 1.0,
          videoConstraints: {
            facingMode: "environment", // Prioritize back camera
            width: { ideal: 1280 }, // Suggest higher resolution
            height: { ideal: 720 }
          }
        };
        
        await html5QrCodeRef.current.start(
          cameraId,
          config,
          (decodedText: string, result: Html5QrcodeResult) => { // onSuccess
            if (html5QrCodeRef.current?.isScanning) {
                html5QrCodeRef.current.stop().then(() => {
                    setIsScannerActive(false);
                    console.log(`QR Code Scanned: ${decodedText}`, result);
                    if (decodedText.includes('/checkin?id=') || decodedText.includes('/staff-checkin?id=')) {
                        toast({ title: "QR Code Scanned", description: `Redirecting to: ${decodedText}` });
                        try {
                            const url = new URL(decodedText, window.location.origin); // Ensure it's treated as a full URL if relative
                            router.push(url.pathname + url.search);
                        } catch (e) {
                             if (decodedText.startsWith('/')) {
                                router.push(decodedText);
                            } else {
                                setScanError("Scanned QR code is not a valid app URL path.");
                                toast({ variant: "destructive", title: "Invalid QR Code", description: "Scanned QR code is not a valid app URL." });
                                setTimeout(() => startScanner(), 3000);
                            }
                        }
                    } else {
                        setScanError("Scanned QR code is not a recognized participant or staff link.");
                        toast({ variant: "destructive", title: "Invalid QR Code", description: "Not a valid participant or staff QR code." });
                        setTimeout(() => startScanner(), 3000); // Restart after delay
                    }
                }).catch(err => {
                    console.error("Error stopping scanner after success:", err);
                    setIsScannerActive(false);
                });
            }
          },
          (errorMessage: string, error: Html5QrcodeError) => { // Optional: For continuous scanning errors
            // This callback can be noisy. Use sparingly.
            // console.warn(`QR Scan Error: ${errorMessage}`, error);
          }
        );
        setIsScannerActive(true);
      } else {
        setScanError("No cameras found on this device.");
        toast({ variant: "destructive", title: "No Cameras", description: "No cameras were found on your device." });
      }
    } catch (err: any) {
      console.error("Error starting scanner:", err);
      if (err.name === "NotAllowedError" || err.message?.toLowerCase().includes("permission denied")) {
        setScanError("Camera permission was denied. Please enable camera access in your browser settings and refresh the page.");
      } else if (err.message?.toLowerCase().includes("requested device not found") || err.name === "NotFoundError") {
         setScanError("Camera not found. It might be in use by another application, disconnected, or no camera is available.");
      } else {
        setScanError(`Failed to start QR scanner: ${err.message || String(err)}`);
      }
      toast({ variant: "destructive", title: "Scanner Error", description: `Could not start QR scanner. ${err.message || String(err)}` });
    } finally {
      setIsLoading(false);
    }
  }, [router, toast, isScannerActive]); // isScannerActive added to prevent race conditions

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const qrReaderElement = document.getElementById(QR_SCANNER_ELEMENT_ID);
      if (!qrReaderElement) {
        console.error(`QR Reader element with ID '${QR_SCANNER_ELEMENT_ID}' not found.`);
        setIsLoading(false);
        setScanError("Scanner UI element not found. Please refresh.");
        return;
      }
      html5QrCodeRef.current = new Html5Qrcode(QR_SCANNER_ELEMENT_ID, { verbose: false });
      startScanner();
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop()
          .then(() => {
            console.log("QR Scanner stopped successfully on unmount/cleanup.");
            setIsScannerActive(false);
          })
          .catch(err => console.error("Error stopping QR scanner on unmount/cleanup:", err));
      }
    };
  }, [startScanner]);


  return (
    <AppLayoutClientShell>
      <div className="container mx-auto p-4 flex flex-col items-center">
        <Card className="w-full max-w-xl shadow-xl border-t-4 border-primary">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
              <ScanLine className="h-8 w-8" /> QR Code Scanner
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground pt-1">
              Point your camera at a Participant or Staff QR code for quick check-in or status updates.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 py-8">
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-72 w-full bg-muted rounded-lg">
                <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                <p className="text-lg text-muted-foreground">Initializing Scanner...</p>
              </div>
            )}

            <div 
                id={QR_SCANNER_ELEMENT_ID} 
                className="w-full max-w-md rounded-lg overflow-hidden shadow-md"
                style={{ 
                    aspectRatio: '1 / 1', // Enforce square aspect ratio for the container
                    display: isLoading ? 'none' : 'block',
                    border: isScannerActive && !scanError ? '3px solid hsl(var(--primary))' : '3px dashed hsl(var(--border))',
                    background: 'hsl(var(--muted))'
                }}
            >
               {/* Video feed will be rendered here by Html5Qrcode library */}
               {!isLoading && !isScannerActive && !scanError && (
                 <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                   <CameraOff className="h-16 w-16 mb-4 opacity-50" />
                   <p>Preparing camera...</p>
                 </div>
               )}
            </div>
            
            {scanError && (
              <Alert variant="destructive" className="w-full max-w-md">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle>Scanner Error</AlertTitle>
                <AlertDescription>{scanError}</AlertDescription>
              </Alert>
            )}
            
            {!isLoading && isScannerActive && !scanError && (
                <p className="text-lg font-medium text-primary animate-pulse">Scanning... Aim at QR Code</p>
            )}
            {!isLoading && !isScannerActive && scanError && (
                 <Button onClick={startScanner} variant="outline" className="mt-4">
                    <CameraOff className="mr-2 h-4 w-4" /> Retry Scanner
                </Button>
            )}

          </CardContent>
           <CardFooter className="flex flex-col items-center gap-4 pt-6 border-t">
            <Button variant="ghost" asChild className="w-full max-w-xs text-muted-foreground hover:text-primary">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                </Link>
            </Button>
            <p className="text-xs text-muted-foreground text-center px-4">
                Ensure your browser has camera permissions enabled for this site. Using the rear camera is often best.
            </p>
          </CardFooter>
        </Card>
      </div>
    </AppLayoutClientShell>
  );
}
