import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
import {Scoreboard,type useGameScores} from './Scoreboard';
it('renders the existing ranked display without public origin badges or actual-player totals',()=>{
 const listing={displayTop:[{id:'sample',nickname:'Example player',score:30,createdAt:'2026-10-01',sample:true},{id:'real',nickname:'Visitor',score:20,createdAt:'2026-10-29'}],top:[],totalScores:1,totalPlayers:1,allGamesTotal:4};
 const scores={listing,refresh:vi.fn(),status:'',game:'snake'} as unknown as ReturnType<typeof useGameScores>;
 const markup=renderToStaticMarkup(createElement(Scoreboard,{scores}));
 expect(markup).toContain('High Scores');
 expect(markup.indexOf('Example player')).toBeLessThan(markup.indexOf('Visitor'));
 expect(markup).not.toMatch(/demo|actual|players ·|across four games/i);
 expect(listing.displayTop[0]?.sample).toBe(true);
});
