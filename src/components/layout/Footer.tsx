'use client';

import * as React from 'react';
import { Facebook, Twitter, Instagram, Linkedin, Youtube } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Logos Section */}
        <div className="flex flex-wrap items-center justify-center gap-8 mb-8">
          {/* Logo 1: HARMUN Tracker */}
          <div className="flex items-center justify-center w-32 h-20 bg-muted rounded-lg p-4">
            <span className="text-sm font-semibold text-center">HARMUN Tracker</span>
          </div>
          
          {/* Logo 2: Model UN */}
          <div className="flex items-center justify-center w-32 h-20 bg-muted rounded-lg p-4">
            <span className="text-sm font-semibold text-center">Model UN</span>
          </div>
          
          {/* Logo 3: Partner/Sponsor */}
          <div className="flex items-center justify-center w-32 h-20 bg-muted rounded-lg p-4">
            <span className="text-sm font-semibold text-center">Partner Logo</span>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <Link
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
            aria-label="Facebook"
          >
            <Facebook className="h-5 w-5" />
          </Link>
          <Link
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
            aria-label="Twitter"
          >
            <Twitter className="h-5 w-5" />
          </Link>
          <Link
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
            aria-label="Instagram"
          >
            <Instagram className="h-5 w-5" />
          </Link>
          <Link
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
            aria-label="LinkedIn"
          >
            <Linkedin className="h-5 w-5" />
          </Link>
          <Link
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
            aria-label="YouTube"
          >
            <Youtube className="h-5 w-5" />
          </Link>
        </div>

        {/* Copyright */}
        <div className="text-center text-sm text-muted-foreground">
          <p>© {currentYear} HARMUN Tracker. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
