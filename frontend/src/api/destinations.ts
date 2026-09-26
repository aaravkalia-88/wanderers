import catalog from '../data/destinations.json';
export type Destination = (typeof catalog)[number];
export { catalog };
export const getDestinations = async (mood?: string): Promise<Destination[]> => catalog.filter(d => !mood || mood === 'Any feeling' || d.mood === mood);
