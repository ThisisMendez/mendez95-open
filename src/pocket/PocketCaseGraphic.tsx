import type {ReactNode} from 'react';
import {PocketIcon} from './PocketIcon';
import './pocketCase.css';

/** Compact, original overview art. Detailed source diagrams remain in the full case. */
export function PocketCaseMark({name}:{name:string}) {
 const paths:Record<string,ReactNode>={
  code:<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-3 18"/>,
  check:<><rect x="5" y="4" width="15" height="17" rx="2"/><path d="M9 4V2h7v4H9m0 8 3 3 5-6"/></>,
  search:<><circle cx="10" cy="10" r="7"/><path d="m15 15 7 7"/></>,
  book:<><path d="M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-3-1-7-2-10 1v15M5 8h4m-4 4h4m6-4h4m-4 4h4"/></>,
  people:<><circle cx="9" cy="7" r="4"/><path d="M2 21v-4c0-5 14-5 14 0v4m1-18c6 0 6 8 0 8m2 3c4 0 4 4 4 7"/></>,
  heart:<path d="M12 21 3 12C-3 5 6-1 12 6c6-7 15-1 9 6z"/>,
  activity:<path d="M1 12h5l3-8 6 16 3-8h5"/>,
  receipt:<><path d="M5 2h15v20l-3-2-3 2-3-2-3 2-3-2zM8 7h9m-9 5h9m-9 5h6"/></>,
  bot:<><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M12 2v4M7 11v3m10-3v3m-9 4h8M1 10v7m22-7v7"/></>,
  person:<><circle cx="12" cy="6" r="4"/><path d="M4 22v-5c0-7 16-7 16 0v5"/></>,
  lock:<><rect x="4" y="10" width="16" height="12" rx="2"/><path d="M7 10V6a5 5 0 0 1 10 0v4m-5 5v3"/></>,
  calendar:<><rect x="2" y="4" width="20" height="18" rx="2"/><path d="M2 10h20M7 1v6m10-6v6M7 14h3m4 0h3m-10 4h3"/></>,
  flag:<><path d="M5 23V2c5-3 9 4 15 0v12c-6 4-10-3-15 0"/></>,
  handshake:<path d="m2 9 4-4 6 2 6-2 4 4-4 10-5 3-7-4-4-9Zm4-4 6 5-4 4 3 3m1-7 6 6m-4-3 4-2"/>,
 };
 return <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.check}</svg>;
}
function Node({icon,children,tone='teal'}:{icon:string;children:ReactNode;tone?:string}){return <div className={`pcg-node pcg-${tone}`}><PocketCaseMark name={icon}/><span>{children}</span></div>;}
const Arrow=()=> <span className="pcg-arrow" aria-hidden="true">→</span>;
export function PocketCaseGraphic({caseId}:{caseId:string}) {
 const titles:Record<string,string>={'demo-health-psm':'Shared Path','demo-platform':'Pocket Pipeline','demo-data-field-quality':'Quality Loop','demo-coaching':'Coaching Cartridges','demo-health-platform-lifecycle':'Transaction Flow','demo-health-measure-and-invest':'Ownership Bridge'};
 let art:ReactNode;
 if(caseId==='demo-health-psm') art=<><div className="pcg-lcd-label">ONE SHARED PATH</div><div className="pcg-vendor-path"><div className="pcg-vendors">{[['activity','Hinge Health','yellow'],['WW','WeightWatchers','purple'],['heart','Hello Heart','coral'],['people','Progyny','teal']].map(([icon,label,tone])=><div key={label} className={`pcg-vendor pcg-${tone}`}>{icon==='WW'?<b aria-hidden="true">WW</b>:<PocketCaseMark name={icon!}/>}<span>{label}</span></div>)}</div><Arrow/><div className="pcg-hub"><b aria-hidden="true">✚</b><strong>PSM</strong><small>Example Health</small></div></div><div className="pcg-lcd-label">AUTOMATED PATH · RxClaim</div><div className="pcg-flow"><Node icon="person">Eligibility</Node><Arrow/><Node icon="check" tone="yellow">Claims</Node><Arrow/><Node icon="receipt" tone="purple">Billing</Node></div><p>Member-level billing detail</p><small className="pcg-footnote">Example vendors · No endorsement implied.</small></>;
 else if(caseId==='demo-platform') art=<><div className="pcg-lcd-label">PLANNED PIPELINE</div><div className="pcg-flow pcg-four"><Node icon="code">Code<br/>checks</Node><Arrow/><Node icon="bot" tone="purple">LLM<br/>judge</Node><Arrow/><Node icon="person" tone="yellow">Human<br/>review</Node><Arrow/><Node icon="lock" tone="coral">Release<br/>gate</Node></div><p>Proposed evaluation → controlled access</p><div className="pcg-rule">Critical failures would block release.</div><small className="pcg-footnote">Planned design; execution and calibration are not established.</small></>;
 else if(caseId==='demo-data-field-quality') art=<><div className="pcg-lcd-label">SOURCE DATA QUALITY</div><div className="pcg-flow"><Node icon="check" tone="purple">Audit<br/>records</Node><Arrow/><Node icon="search">Trace<br/>defects</Node><Arrow/><Node icon="book" tone="yellow">Improve<br/>guidance</Node></div><p className="pcg-return">↶ Repeat issues inform the next review</p></>;
 else if(caseId==='demo-coaching') art=<><div className="pcg-lcd-label">PROGRAM BUILDING BLOCKS</div><div className="pcg-grid"><Node icon="people">Recruit<br/>coaches</Node><Node icon="check" tone="purple">Build<br/>programming</Node><Node icon="handshake" tone="yellow">Fund &amp;<br/>partner</Node><Node icon="calendar" tone="coral">Deliver<br/>events</Node></div></>;
 else if(caseId==='demo-health-platform-lifecycle') art=<><div className="pcg-lcd-label">A CONSISTENT TRANSACTION PATH</div><div className="pcg-flow"><Node icon="search" tone="purple">Member<br/>lookup</Node><Arrow/><Node icon="check">Test<br/>claim</Node><Arrow/><Node icon="receipt" tone="yellow">Payment<br/>transaction</Node></div><p>Eligibility before the payment transaction</p></>;
 else if(caseId==='demo-health-measure-and-invest') art=<><div className="pcg-lcd-label">DELIVERY NEEDS MORE THAN CODE</div><div className="pcg-grid"><Node icon="code" tone="purple">Engineering<br/>capacity</Node><Node icon="person" tone="yellow">Product &amp;<br/>operations</Node></div><div className="pcg-down" aria-hidden="true">↓</div><div className="pcg-dark-hub"><PocketCaseMark name="flag"/><strong>Launch readiness</strong></div><p>Faster delivery · More concentrated ownership</p></>;
 else return null;
 return <figure className="pocket-case-graphic" data-graphic={titles[caseId]} aria-label={`${titles[caseId]} — compact project overview`}>{art}</figure>;
}
export function PocketProjectGraphic({title}:{title:string}){return <div className="pocket-project-cartridge"><PocketIcon name="side-projects" size={46}/><div><small>PROJECT FILE</small><strong>{title}</strong></div></div>;}
