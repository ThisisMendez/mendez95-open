export type WidgetLocation={city:string;country:string;countryCode:string;latitude:number;longitude:number;timezone:string;approximate:boolean};
export function validLocation(value:unknown):value is WidgetLocation{
 if(!value||typeof value!=='object')return false;const p=value as WidgetLocation;
 if(typeof p.city!=='string'||!p.city.trim()||typeof p.country!=='string'||!p.country.trim()||typeof p.countryCode!=='string'||!/^[A-Z]{2}$/.test(p.countryCode)||typeof p.approximate!=='boolean'||!Number.isFinite(p.latitude)||Math.abs(p.latitude)>90||!Number.isFinite(p.longitude)||Math.abs(p.longitude)>180||typeof p.timezone!=='string')return false;
 try{new Intl.DateTimeFormat('en',{timeZone:p.timezone});return true;}catch{return false;}
}
export function validTimeZone(zone:unknown):zone is string{if(typeof zone!=='string'||!zone)return false;try{new Intl.DateTimeFormat('en',{timeZone:zone});return true;}catch{return false;}}
export function visitorTimezone(fallback:boolean,location:WidgetLocation,browserZone:string){return !fallback&&validTimeZone(location.timezone)?location.timezone:validTimeZone(browserZone)?browserZone:'UTC';}
export function relativeHours(zone:string,visitorZone:string,now:number){if(!validTimeZone(zone)||!validTimeZone(visitorZone)||!Number.isFinite(now))return null;const offset=(tz:string)=>{const text=new Intl.DateTimeFormat('en-US',{timeZone:tz,timeZoneName:'longOffset'}).formatToParts(now).find(p=>p.type==='timeZoneName')?.value||'';const m=text.match(/GMT([+-])(\d{2}):(\d{2})/);return m?(m[1]==='-'?-1:1)*(Number(m[2])+Number(m[3])/60):0;};return offset(zone)-offset(visitorZone);}
