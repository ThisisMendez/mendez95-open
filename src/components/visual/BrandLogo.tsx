/** Full artwork and symbol-only views use the owner's supplied transparent web kit. */
export function BrandLogo({ symbol = false, className = '', decorative = false }: {
  symbol?: boolean;
  className?: string;
  decorative?: boolean;
}) {
  return <img
    className={`${symbol ? 'os-brand-symbol' : 'os-brand-logo'} ${className}`}
    src={symbol ? '/brand/logo-mark.svg' : '/brand/logo.svg'}
    width={839}
    height={symbol ? 915 : 1083}
    alt={decorative ? '' : symbol ? 'Mendez 95 symbol' : 'Jordan Example 95'}
    aria-hidden={decorative || undefined}
    draggable={false}
  />;
}
