import{it,expect}from'vitest';import{relativeHours,validLocation,visitorTimezone}from'./location';
const p={city:'London',country:'United States',countryCode:'US',latitude:42,longitude:-71,timezone:'America/New_York',approximate:false};
it('uses timezone-only fallback without pretending to detect a city; validates stored corrections',()=>{expect(visitorTimezone(true,p,'America/Santo_Domingo')).toBe('America/Santo_Domingo');expect(visitorTimezone(false,p,'Asia/Tokyo')).toBe('America/New_York');expect(validLocation(p)).toBe(true);expect(validLocation({...p,timezone:'not/a-zone'})).toBe(false);expect(validLocation({...p,latitude:100})).toBe(false);});
it('compares actual date-specific offsets including unequal DST change dates',()=>{expect(relativeHours('Europe/London','America/New_York',Date.parse('2026-03-15T12:00:00Z'))).toBe(4);expect(relativeHours('Europe/London','America/New_York',Date.parse('2026-01-15T12:00:00Z'))).toBe(5);expect(relativeHours('Asia/Kolkata','America/New_York',Date.parse('2026-07-15T12:00:00Z'))).toBe(9.5);});
it('rejects partial or malformed stored cities and never turns a timezone into a city',()=>{
 for(const patch of[{city:'  '},{country:' '},{countryCode:'__'},{countryCode:'12'},{approximate:'yes'},{latitude:NaN},{timezone:''}])expect(validLocation({...p,...patch})).toBe(false);
 expect(visitorTimezone(true,p,'invalid/zone')).toBe('UTC');expect(relativeHours('invalid/zone','UTC',Date.now())).toBeNull();
});
