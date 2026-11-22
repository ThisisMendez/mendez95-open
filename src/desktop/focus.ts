import type { AppId } from './registry';

export function restoreLauncherFocus(appId: AppId) {
  requestAnimationFrame(() => {
    const choices = [`mobile-launcher-${appId}`, `launcher-${appId}`, 'start-button', 'mobile-start-button'];
    const target = choices.map(id => document.getElementById(id)).find(element => element && element.getClientRects().length > 0);
    target?.focus();
  });
}
