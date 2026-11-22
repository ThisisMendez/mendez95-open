import { AppIcon } from './AppIcon';
import './caseIcons.css';
/** One stable-ID mapping for folder, window, taskbar and menu case artwork. */
export const caseIconAssets: Record<string, string> = {
  'demo-health-psm': '/brand/case-icons/digital-health-platform.svg',
  'demo-health-platform-lifecycle': '/brand/case-icons/partner-api-lifecycle.svg',
  'demo-health-measure-and-invest': '/brand/case-icons/platform-investment.svg',
  'demo-platform': '/brand/case-icons/demo-platform.svg',
  'demo-data-field-quality': '/brand/case-icons/demo-data.svg',
  'demo-coaching': '/brand/case-icons/demo-coaching-athletics.svg',
};
export function CaseIcon({ caseId, size = 32, fallback = 'work' }: { caseId?: string; size?: number; fallback?: string }) {
  const src = caseId ? caseIconAssets[caseId] : undefined;
  return src ? <img className="os-case-icon" src={src} width={size} height={size} alt="" aria-hidden="true" draggable={false}/> : <AppIcon name={fallback} size={size}/>;
}
