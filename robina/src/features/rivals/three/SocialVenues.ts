import type { WorldState } from '../world/WorldState';
export type VenueId = 'bar'|'restaurant';
export const SOCIAL_VENUES = [
  {id:'bar' as const,name:'THE AMBER ROOM',subtitle:'WATERFRONT BAR / FOOD & MUSIC',x:126,z:44,waiter:{x:124,z:44},menu:['wine','dinner','party'] as const},
  {id:'restaurant' as const,name:'CASA MERIDIAN',subtitle:'RESTAURANT / WATERFRONT DINING',x:126,z:68,waiter:{x:124,z:68},menu:['coffee','meal'] as const},
];
export const venueAt = (id:VenueId) => SOCIAL_VENUES.find(venue=>venue.id===id)!;
export function socialWalls(){
  return SOCIAL_VENUES.flatMap(venue=>[
    {id:`${venue.id}-west`,x:venue.x-5.6,z:venue.z,w:.25,d:11.2,h:3.1},
    {id:`${venue.id}-north`,x:venue.x,z:venue.z-5.6,w:11.2,d:.25,h:3.1},
    {id:`${venue.id}-south`,x:venue.x,z:venue.z+5.6,w:11.2,d:.25,h:3.1},
    {id:`${venue.id}-entry-a`,x:venue.x+5.6,z:venue.z-3.6,w:.25,d:4,h:2.6},
    {id:`${venue.id}-entry-b`,x:venue.x+5.6,z:venue.z+3.6,w:.25,d:4,h:2.6},
    {id:`${venue.id}-counter`,x:venue.x-3.7,z:venue.z,w:.8,d:6,h:1.05},
    {id:`${venue.id}-table-a`,x:venue.x+1.9,z:venue.z-3,w:1.35,d:1.35,h:.8},
    {id:`${venue.id}-table-b`,x:venue.x+1.9,z:venue.z+3,w:1.35,d:1.35,h:.8},
  ]);
}
export function addSocialWalls(world:WorldState){for(const part of socialWalls())world.blockers.push({id:'social-'+part.id,x:part.x*40,y:part.z*40,width:part.w*40,height:part.d*40,enabled:true});}
export function nearbyVenue(x:number,z:number){return SOCIAL_VENUES.find(venue=>Math.hypot(x-venue.waiter.x,z-venue.waiter.z)<2.4);}
