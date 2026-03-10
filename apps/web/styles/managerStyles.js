/**
 * F8: Manager UI Styling Lock File
 *
 * All shared / reusable manager UI styles live here.
 * New inline styles in manager workspace pages should be extracted to this file.
 * Styling PRs must modify this file or justify a new shared style layer.
 *
 * Usage:
 *   import { styles } from '../../styles/managerStyles';
 *   <div style={styles.card}>...</div>
 */

export const styles = {
  /* ── Layout ── */
  card: { display: 'grid', gap: 10 },
  gridGap12: { display: 'grid', gap: 12 },
  rowSpaceBetween: { justifyContent: 'space-between', alignItems: 'baseline' },
  rowWrap: { flexWrap: 'wrap' },
  rowGap8: { gap: 8 },
  rowGap6: { gap: 6, marginTop: 0 },
  rowGap8Wrap: { gap: 8, flexWrap: 'wrap' },
  rowSpaceBetweenWrap: { justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },

  /* ── Typography ── */
  bold: { fontWeight: 700 },
  headingFlush: { margin: 0 },
  subtleText: { color: '#444' },
  errorText: { color: 'crimson' },
  okText: { color: '#116b2b' },

  /* ── Spacing ── */
  marginTop12: { marginTop: 12 },
  marginTop10: { marginTop: 10 },
  noMarginBottom: { marginBottom: 0 },
  hr: { margin: '18px 0' },

  /* ── Form ── */
  thresholdInput: { width: 140, marginBottom: 0 },
  searchInput: { minWidth: 220, marginBottom: 0 },
  noticePadding: { padding: 6, marginBottom: 0 },

  /* ── Empty State ── */
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    color: '#6b7280',
  },
  emptyStateText: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: 0,
  },

  /* ── Coming Soon Stub ── */
  comingSoonContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    textAlign: 'center',
  },
  comingSoonBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    backgroundColor: '#f0f9ff',
    color: '#0369a1',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: '12px',
  },
  comingSoonTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1e293b',
    margin: '0 0 8px 0',
  },
  comingSoonText: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
    maxWidth: '400px',
  },
};

export default styles;
