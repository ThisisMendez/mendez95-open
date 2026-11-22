export type TranscriptMetrics = {scrollHeight:number;clientHeight:number;scrollTop:number};
/** A few text lines of tolerance lets readers follow without pinning them to pixels. */
export function isNearTranscriptBottom({scrollHeight,clientHeight,scrollTop}:TranscriptMetrics){return scrollHeight-clientHeight-scrollTop<=64;}
export function shouldFollowTranscript({initial,posted,nearBottom}:{initial:boolean;posted:boolean;nearBottom:boolean}){return initial||posted||nearBottom;}
