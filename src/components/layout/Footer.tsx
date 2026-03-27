'use client';

import * as React from 'react';
import { Facebook, Twitter, Instagram } from 'lucide-react';
import Link from 'next/link';
import { PUBLIC_EVENT_CONFIG } from '@/lib/public-event-config';

/**
 * FOOTER CONFIGURATION
 * Edit these values to manually update the footer content easily.
 */
const FOOTER_CONFIG = {
  // Brand name and copyright text
  brandName: 'HARMUN Tracker',

  // Social Media Links: Set href to '#' to hide or use the actual URL
  socials: [
    { name: 'Facebook', icon: Facebook, href: 'https://www.facebook.com/RaficHaririHighSchool' },
    { name: 'Twitter', icon: Twitter, href: 'https://x.com/RHHS_Saida' },
    { name: 'Instagram', icon: Instagram, href: 'https://www.instagram.com/rhhs.un.society' },
  ],

  // Bottom text
  reservedRightsText: 'All rights reserved.',
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Logos Section */}
        <div className="mb-12">
          <p className="text-center text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-8 italic opacity-70">
            Powered by & Supported by
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
            {PUBLIC_EVENT_CONFIG.heroImagePaths.map((src, index) => (
              <div
                key={`footer-logo-${index}`}
                className="group relative flex items-center justify-center w-28 h-20 sm:w-36 sm:h-24 transition-all duration-300 ease-out grayscale hover:grayscale-0"
              >
                <div className="absolute inset-0 bg-primary/5 rounded-2xl scale-0 group-hover:scale-100 transition-transform duration-500" />
                <img
                   src={src}
                   alt={`Footer Logo ${index + 1}`}
                   className="relative z-10 w-full h-full object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-sm group-hover:drop-shadow-md"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="h-px w-24 bg-primary/20 mx-auto mb-8" />

        {/* Social Media Links */}
        <div className="flex items-center justify-center gap-8 mb-8">
          {FOOTER_CONFIG.socials.map((social) => {
            if (social.href === '#') return null;
            const Icon = social.icon;
            return (
              <Link
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-all duration-300 transform hover:-translate-y-1 hover:scale-110"
                aria-label={social.name}
              >
                <Icon className="h-7 w-7 drop-shadow-sm" />
              </Link>
            );
          })}
        </div>

        {/* Copyright */}
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">
            © {currentYear} <span className="text-primary font-bold">{FOOTER_CONFIG.brandName}</span>. {FOOTER_CONFIG.reservedRightsText}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-2 tracking-widest uppercase font-black italic">
            Developed for Excellence in MUN Operations
          </p>
        </div>
      </div>
    </footer>
  );
}
