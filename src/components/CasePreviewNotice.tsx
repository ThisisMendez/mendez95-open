import './casePreview.css';
export function CasePreviewNotice({stage}:{stage?:string}) {
  return stage==='preview'?<p className="os-case-preview-notice" role="note">Full case study coming soon</p>:null;
}
