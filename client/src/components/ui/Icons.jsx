import { memo } from "react";

export const VerifiedTick = memo(({ style }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '6px', color: '#3da5d9', display: 'inline-block', verticalAlign: 'middle', ...style }}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="16 8 11 13 8 10" />
    </svg>
));

export const AdminIcon = memo(({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
));

export const HelpIcon = memo(({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
));

/**
 * DualBadge — crossfades ✨ and VerifiedTick every 3s in the same slot.
 * Use when a user is both a contact AND verified.
 */
export const DualBadge = memo(() => (
    <span className="dual-badge" aria-label="Contact & Verified" title="Contact & Verified">
        <span className="dual-badge-sparkle">✨</span>
        <span className="dual-badge-tick">
            <VerifiedTick style={{ marginLeft: 0, position: 'relative', top: 0 }} />
        </span>
    </span>
));
