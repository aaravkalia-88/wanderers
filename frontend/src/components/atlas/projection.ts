// Spherical Mercator, centered on India. Geometry and pins share this projection.
export function projectLocation(latitude: number, longitude: number): [number, number] {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Invalid map coordinate');
  const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * Math.PI / 360));
  return [(longitude - 82) * .32, -(mercator(latitude) - mercator(23)) * 180 / Math.PI * .32];
}

export const normalizeState = (name: string) => name.replace(' & ', ' and ');
// ponytail: stylized regional relief, replace with licensed DEM tiles for surveyed terrain.
export function getRegionalElevation(state: string): {depth: number; lift: number} {
  const name = normalizeState(state);
  if (['Ladakh', 'Himachal Pradesh', 'Uttarakhand', 'Sikkim', 'Arunachal Pradesh', 'Jammu and Kashmir'].includes(name)) return {depth: .38, lift: .16};
  if (['Meghalaya', 'Nagaland', 'Manipur', 'Mizoram', 'Kerala', 'Karnataka'].includes(name)) return {depth: .28, lift: .08};
  if (['Madhya Pradesh', 'Chhattisgarh', 'Maharashtra', 'Telangana'].includes(name)) return {depth: .22, lift: .04};
  return {depth: .16, lift: 0};
}
