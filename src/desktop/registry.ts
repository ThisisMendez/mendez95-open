export type AppId = 'work' | 'about' | 'resume' | 'contact' | 'field-notes' | 'ai-lab' | 'side-projects' | 'photos' | 'guide' | 'games' | 'board' | 'settings' | 'accessories' | 'system-about' | 'system-update' | 'find' | 'help' | 'run' | 'shutdown' | 'paint' | 'tools' | 'weather' | 'world-time' | 'pocket-radio' | 'visitor-log' | 'signal' | 'mendez-world';

export type AppDefinition = {
  id: AppId;
  label: string;
  route: string;
  icon: string;
  desktop: boolean;
  order: number;
  enabled: boolean;
};

/** Navigation destinations, independent of editorial content. */
export const appRegistry: AppDefinition[] = [
 ...([['mendez-world','Mendez World','photos'],['tools','Pocket Tools','settings'],['weather','Weather Station','weather'],['world-time','World Time','clock'],['pocket-radio','Pocket Radio','music'],['visitor-log','Visitor Log','board'],['signal','Signal','contact']] as const).map(([id,label,icon],i)=>({id,label,icon,route:`/${id}`,desktop:false,order:30+i,enabled:true})),
  { id: 'about', label: 'About', route: '/about', icon: 'about', desktop: true, order: 1, enabled: true },
  { id: 'resume', label: 'Resume', route: '/resume', icon: 'resume', desktop: true, order: 2, enabled: true },
  { id: 'contact', label: 'Contact', route: '/contact', icon: 'contact', desktop: true, order: 3, enabled: true },
  { id: 'settings', label: 'Settings', route: '/settings', icon: 'settings', desktop: true, order: 4, enabled: true },
  { id: 'board', label: 'Chatroom 95', route: '/board', icon: 'board', desktop: true, order: 5, enabled: true },
  { id: 'work', label: 'Portfolio', route: '/work', icon: 'work', desktop: true, order: 6, enabled: true },
  { id: 'games', label: 'Games', route: '/games', icon: 'games', desktop: true, order: 7, enabled: true },
  { id: 'side-projects', label: 'Side Projects', route: '/side-projects', icon: 'side-projects', desktop: true, order: 8, enabled: true },
  { id: 'accessories', label: 'Accessories', route: '/accessories', icon: 'accessories', desktop: true, order: 9, enabled: true },
  { id: 'field-notes', label: 'Field Notes', route: '/field-notes', icon: 'field-notes', desktop: true, order: 10, enabled: true },
  { id: 'ai-lab', label: 'AI Lab', route: '/ai-lab', icon: 'ai-lab', desktop: false, order: 11, enabled: true },
  { id: 'photos', label: 'Photos', route: '/photos', icon: 'photos', desktop: false, order: 12, enabled: true },
  { id: 'guide', label: 'SNIP-E', route: '/guide', icon: 'guide', desktop: false, order: 13, enabled: true },
  { id: 'paint', label: 'Paint', route: '/paint', icon: 'paint', desktop: false, order: 13.5, enabled: true },
  { id: 'system-about', label: 'About Mendez 95', route: '/system-about', icon: 'system-about', desktop: false, order: 14, enabled: true },
  { id: 'system-update', label: 'System Update', route: '/system-update', icon: 'system-update', desktop: false, order: 15, enabled: true },
  { id: 'find', label: 'Find', route: '/find', icon: 'find', desktop: false, order: 16, enabled: true },
  { id: 'help', label: 'Help', route: '/help', icon: 'help', desktop: false, order: 17, enabled: true },
  { id: 'run', label: 'Run', route: '/run', icon: 'run', desktop: false, order: 18, enabled: true },
  { id: 'shutdown', label: 'Shut Down', route: '/shutdown', icon: 'shutdown', desktop: false, order: 19, enabled: true },
];

export const availableApps = () => appRegistry.filter(app => app.enabled).sort((a, b) => a.order - b.order);
export const appById = (id: AppId) => appRegistry.find(app => app.id === id && app.enabled);
