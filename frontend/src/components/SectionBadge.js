import React from 'react';
import './SectionBadge.css';

/**
 * Chip pequeño con color semántico.
 * tone: input | config | results | automaton | tree | tables | ai | top-down | bottom-up | neutral
 */
const SectionBadge = ({ tone = 'neutral', children, icon, className = '' }) => (
  <span className={`section-badge tone-${tone} ${className}`}>
    {icon && <span className="section-badge-icon" aria-hidden="true">{icon}</span>}
    <span>{children}</span>
  </span>
);

export default SectionBadge;
