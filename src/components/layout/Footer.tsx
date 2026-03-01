'use client';

import * as React from 'react';
import { Facebook, Twitter, Instagram, Linkedin, Youtube } from 'lucide-react';
import Link from 'next/link';

/**
 * FOOTER CONFIGURATION
 * Edit these values to manually update the footer content easily.
 */
const FOOTER_CONFIG = {
  // Brand name and copyright text
  brandName: 'HARMUN Tracker',

  // Logos section: You can add, remove or edit logos here
  logos: [
    { label: 'HARMUN Tracker', type: 'text' },
    { label: 'Model UN', type: 'text' },
    { label: 'Partner Logo', type: 'text' },
  ],

  // Social Media Links: Set href to '#' to hide or use the actual URL
  socials: [
    { name: 'Facebook', icon: Facebook, href: 'https://facebook.com' },
    { name: 'Twitter', icon: Twitter, href: 'https://twitter.com' },
    { name: 'Instagram', icon: Instagram, href: 'https://instagram.com' },
    { name: 'LinkedIn', icon: Linkedin, href: 'https://linkedin.com' },
    { name: 'YouTube', icon: Youtube, href: 'https://youtube.com' },
  ],

  // Bottom text
  reservedRightsText: 'All rights reserved.',
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Logos Section */}
        <div className="flex flex-wrap items-center justify-center gap-8 mb-8">
          {FOOTER_CONFIG.logos.map((logo, index) => (
            <div key={`footer-logo-${index}`} className="flex items-center justify-center w-32 h-20 bg-muted rounded-lg p-4">
              <span className="text-sm font-semibold text-center">{logo.label}</span>
            </div>
          ))}
        </div>

        {/* Social Media Links */}
        <div className="flex items-center justify-center gap-6 mb-6">
          {FOOTER_CONFIG.socials.map((social) => {
            if (social.href === '#') return null;
            const Icon = social.icon;
            return (
              <Link
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label={social.name}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </div>

        {/* Copyright */}
        <div className="text-center text-sm text-muted-foreground">
          <p>© {currentYear} {FOOTER_CONFIG.brandName}. {FOOTER_CONFIG.reservedRightsText}</p>
        </div>
      </div>
    </footer>
  );
}
