import Badge from '../common/Badge.jsx';
import { RISK_STYLES } from '../../utils/constants.js';

export default function RiskBadge({ risk }) {
  const styles = RISK_STYLES[risk] || RISK_STYLES.LOW;
  return <Badge className={styles.badge}>{styles.label}</Badge>;
}
