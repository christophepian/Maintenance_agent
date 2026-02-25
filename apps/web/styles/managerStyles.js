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
};

export default styles;
