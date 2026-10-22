import { describe, it, expect } from 'vitest';
import { activateSeason } from '../../supabase/functions/_shared/seasonActivation';
import { validateSportsSeason } from '../../supabase/functions/_shared/sportsSeason';

const config=validateSportsSeason({season:2027,timezone:'Europe/Oslo',teams:[
  {team:'A-laget',tournament_id:'300001',team_id:'311',expected_teams:14,league:'4. divisjon',club_name:'Fagerborg'},
  {team:'B-laget',tournament_id:'300002',team_id:'6458',expected_teams:12,league:'6. divisjon',club_name:'Fagerborg 2'},
]});
describe('Season activation order',()=>{
  it('publishes and reads back the 2027 manifest before activating 2027',async()=>{
    const calls:string[]=[];
    await activateSeason(config,{publish:async c=>{expect(c.teams[0].expected_teams).toBe(14);calls.push('publish');},read:async()=>{calls.push('read');return config;},activate:async s=>{expect(s).toBe(2027);calls.push('activate');}});
    expect(calls).toEqual(['publish','read','activate']);
  });
  it('never activates on GitHub failure',async()=>{
    let activated=false;
    await expect(activateSeason(config,{publish:async()=>{throw new Error('GitHub failure');},read:async()=>config,activate:async()=>{activated=true;}})).rejects.toThrow('GitHub failure');
    expect(activated).toBe(false);
  });
  it('never activates a configuration that differs from the verified manifest',async()=>{
    let activated=false;
    await expect(activateSeason(config,{publish:async()=>{},read:async()=>({...config,season:2026}),activate:async()=>{activated=true;}})).rejects.toThrow('does not match');
    expect(activated).toBe(false);
  });
});