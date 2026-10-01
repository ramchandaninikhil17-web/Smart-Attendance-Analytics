import React from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="not-found">
      <span className="eyebrow">404 · PAGE NOT FOUND</span>
      <h1>This page wandered off.</h1>
      <p>The requested location does not exist in the CHARUSAT attendance workspace.</p>
      <Link href="/overview" className="button button-primary">
        <ArrowRight size={15} /> Return to overview
      </Link>
    </div>
  );
}
