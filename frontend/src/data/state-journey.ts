import type {Destination} from '../api/destinations';

export const corridors = [
  {name: 'Himalayan North', color: '#98c8c0', states: ['Himachal Pradesh', 'Uttarakhand', 'Ladakh', 'Jammu and Kashmir', 'Jammu & Kashmir']},
  {name: 'Desert West', color: '#dfb97e', states: ['Rajasthan', 'Gujarat']},
  {name: 'Central Highlands', color: '#c1c78d', states: ['Madhya Pradesh', 'Chhattisgarh']},
  {name: 'Deccan & Sahyadris', color: '#b5bb85', states: ['Maharashtra']},
  {name: 'Tropical South', color: '#82bfa6', states: ['Goa', 'Karnataka', 'Kerala', 'Tamil Nadu', 'Andhra Pradesh', 'Telangana']},
  {name: 'East & Northeast', color: '#a8becf', states: ['Sikkim', 'Meghalaya', 'Nagaland', 'Manipur', 'Odisha', 'West Bengal', 'Bihar', 'Jharkhand']},
];
// Unknown future states still appear: the catalog, never a hardcoded stop list, owns coverage.
export function buildJourney(places: Destination[]) {
  return places.map(place => ({place, corridor: corridors.findIndex(c => c.states.includes(place.state))}))
    .sort((a, b) => (a.corridor < 0 ? corridors.length : a.corridor) - (b.corridor < 0 ? corridors.length : b.corridor))
    .map(({place, corridor}) => ({place, corridor, state: place.state, title: place.name, description: place.description,
      region: corridors[corridor]?.name || 'Further discoveries', color: corridors[corridor]?.color || '#a8becf'}));
}
