import Badge from '../common/Badge.jsx';
import { SEVERITY_STYLES } from '../../utils/constants.js';

export default function SeverityBadge({ severity }) {
  const styles = SEVERITY_STYLES[severity] || SEVERITY_STYLES.LOW;
  return <Badge className={styles}>{severity}</Badge>;
}
