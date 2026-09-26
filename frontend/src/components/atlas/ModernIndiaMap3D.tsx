import {memo, useEffect, useMemo, useRef, useState, ComponentRef} from 'react';
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei/core/OrbitControls';
import {Html} from '@react-three/drei/web/Html';
import {Shape, Path, Vector2, Vector3, ExtrudeGeometry, EdgesGeometry, Mesh, MeshBasicMaterial} from 'three';
import type {Destination} from '../../api/destinations';
import type {Entry} from '../../api/travel';
import {projectLocation, getRegionalElevation, normalizeState} from './projection';

type Polygon = number[][][];
interface Feature {properties: {ST_NM: string}; geometry: {type: 'Polygon' | 'MultiPolygon'; coordinates: Polygon | Polygon[]}}
interface Props {places: Destination[]; entries: Entry[]; selected?: number; onSelect: (place: Destination) => void; dark: boolean; reduced: boolean; onUnavailable: () => void; journey?: {stops: Destination[]; active: number}}
const palette = ['#ccd6c4', '#e6d7b9', '#bbccbd', '#d9c4aa', '#d8dfcb', '#c2d0c5'];

const States = memo(function States({features, dark, activeState}: {features: Feature[]; dark: boolean; activeState?: string}) {
  const geometries = useMemo(() => features.map(feature => {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates as Polygon] : feature.geometry.coordinates as Polygon[];
    const shapes = polygons.filter(p => p[0]?.length >= 4).map(rings => {
      const points = (ring: number[][]) => ring.map(([lng, lat]) => {const [x, z] = projectLocation(lat, lng); return new Vector2(x, -z);});
      const shape = new Shape(points(rings[0]));
      shape.holes = rings.slice(1).filter(ring => ring.length >= 4).map(ring => new Path(points(ring)));
      return shape;
    });
    return new ExtrudeGeometry(shapes, {depth: getRegionalElevation(feature.properties.ST_NM).depth, bevelEnabled: true, bevelThickness: .025, bevelSize: .014, bevelSegments: 1, curveSegments: 1, steps: 1});
  }), [features]);
  const edges = useMemo(() => geometries.map(geometry => new EdgesGeometry(geometry, 35)), [geometries]);
  useEffect(() => () => {geometries.forEach(g => g.dispose()); edges.forEach(g => g.dispose());}, [geometries, edges]);
  return <group rotation={[-Math.PI / 2, 0, 0]}>{geometries.map((geometry, index) => {
    const active = normalizeState(features[index].properties.ST_NM) === normalizeState(activeState || '');
    return <group key={index} position={[0, 0, getRegionalElevation(features[index].properties.ST_NM).lift]}>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial color={active ? '#dfb773' : dark ? ['#3e655b', '#657357', '#405b61'][index % 3] : palette[index % palette.length]} roughness={.8} metalness={.12} emissive={active ? '#88602b' : '#000000'} emissiveIntensity={.16}/>
      </mesh>
      <lineSegments geometry={edges[index]}><lineBasicMaterial color={active ? '#fce0a8' : dark ? '#92b8a3' : '#70877a'} transparent opacity={active ? .9 : .4}/></lineSegments>
    </group>;
  })}</group>;
});

function Pin({place, status, selected, onSelect, reduced}: {place: Destination; status?: string; selected: boolean; onSelect: Props['onSelect']; reduced: boolean}) {
  const [hovered, setHovered] = useState(false);
  const ring = useRef<Mesh>(null);
  const age = useRef(0);
  const invalidate = useThree(state => state.invalidate);
  const [x, z] = projectLocation(place.latitude, place.longitude);
  const elevation = getRegionalElevation(place.state);
  const color = status === 'Visited' ? '#299e86' : status === 'Saved' || status === 'Want To Visit' ? '#dca039' : '#d76e45';
  useEffect(() => {age.current = 0; invalidate();}, [selected, hovered, reduced, invalidate]);
  useFrame((_, delta) => {
    if (!ring.current || reduced || !(selected || hovered) || age.current >= 2) return;
    age.current += Math.min(delta, .05);
    const phase = age.current % 1;
    ring.current.scale.setScalar(1 + phase * 2);
    (ring.current.material as MeshBasicMaterial).opacity = (1 - phase) * .55;
    invalidate();
  });
  return <group position={[x, elevation.depth + elevation.lift + .04, z]}
    onPointerOver={event => {event.stopPropagation(); setHovered(true);}}
    onPointerOut={() => setHovered(false)} onClick={event => {event.stopPropagation(); onSelect(place);}}>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.12, .145, 32]}/><meshBasicMaterial color={color} transparent opacity={.45} depthWrite={false}/></mesh>
    <mesh position={[0, .22, 0]}><cylinderGeometry args={[.018, .028, .44, 6]}/><meshBasicMaterial color={color} transparent opacity={.55}/></mesh>
    <mesh position={[0, .48, 0]} scale={hovered || selected ? 1.35 : 1}><octahedronGeometry args={[.12]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.65} roughness={.25} metalness={.25}/></mesh>
    {(hovered || selected) && <Html position={[0, .82, 0]} center zIndexRange={[20, 0]}><button className="atlas-pin-label" onClick={event => {event.stopPropagation(); onSelect(place);}}><small>{place.state}</small><b>{place.name}</b><span>Explore place ↗</span></button></Html>}
  </group>;
}

function JourneyCamera({journey, reduced}: {journey: NonNullable<Props['journey']>; reduced: boolean}) {
  const invalidate = useThree(state => state.invalidate);
  const look = useRef(new Vector3(0, 0, 0));
  const destination = useMemo(() => {
    const place = journey.stops[journey.active];
    if (!place) return null;
    const [x, z] = projectLocation(place.latitude, place.longitude);
    return journey.active === 0 ? {eye: new Vector3(0, 16, 10), look: new Vector3(0, .2, 0)} : {eye: new Vector3(x + 1.2, 10.5, z + 8), look: new Vector3(x, .2, z)};
  }, [journey.stops, journey.active]);
  useEffect(() => {invalidate();}, [destination, reduced, invalidate]);
  useFrame(({camera}, delta) => {
    if (!destination) return;
    const alpha = reduced ? 1 : 1 - Math.exp(-4 * Math.min(delta, .1));
    camera.position.lerp(destination.eye, alpha);
    look.current.lerp(destination.look, alpha);
    camera.lookAt(look.current);
    if (camera.position.distanceToSquared(destination.eye) > .00001 || look.current.distanceToSquared(destination.look) > .00001) invalidate();
  });
  return null;
}

export default function ModernIndiaMap3D({places, entries, selected, onSelect, dark, reduced, onUnavailable, journey}: Props) {
  const [features, setFeatures] = useState<Feature[]>();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const [contextCanvas, setContextCanvas] = useState<HTMLCanvasElement>();
  useEffect(() => {
    const controller = new AbortController();
    fetch('/india-states.geojson', {signal: controller.signal}).then(response => {
      if (!response.ok) throw new Error('Atlas unavailable');
      return response.json();
    }).then(data => {if (!Array.isArray(data.features) || !data.features.length) throw new Error('Empty atlas'); setFeatures(data.features);})
      .catch(() => {if (!controller.signal.aborted) onUnavailable();});
    return () => controller.abort();
  }, [onUnavailable]);
  useEffect(() => {
    if (!contextCanvas) return;
    const lost = (event: Event) => {event.preventDefault(); onUnavailable();};
    contextCanvas.addEventListener('webglcontextlost', lost);
    contextCanvas.dataset.atlasReady = 'true';
    return () => {contextCanvas.removeEventListener('webglcontextlost', lost); delete contextCanvas.dataset.atlasReady;};
  }, [contextCanvas, onUnavailable]);
  if (!features) return <div className="atlas-loading" role="status">Unfolding India…</div>;
  return <>
    <Canvas camera={{position: [0, 16, 10], fov: 43, near: .1, far: 100}} dpr={[1, 1.5]} frameloop="demand" shadows
      gl={{antialias: true, alpha: true, powerPreference: 'low-power'}} onCreated={({gl}) => setContextCanvas(gl.domElement)} fallback={<div className="atlas-loading">3D is unavailable. Choose a place below.</div>}>
      <ambientLight intensity={.75}/><hemisphereLight args={['#d5e7ec', '#716747', .65]}/><directionalLight position={[-6, 12, 4]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-.001}/>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.05, 0]} receiveShadow><planeGeometry args={[40, 40]}/><shadowMaterial transparent opacity={.12}/></mesh>
      <States features={features} dark={dark} activeState={places.find(place => place.id === selected)?.state}/>
      {places.map(place => <Pin key={place.id} place={place} status={entries.find(entry => entry.place_id === place.id)?.status} selected={selected === place.id} onSelect={onSelect} reduced={reduced}/>)}
      {journey ? <JourneyCamera journey={journey} reduced={reduced}/> : <OrbitControls ref={controls} makeDefault enablePan={false} enableZoom={false} enableDamping={!reduced} dampingFactor={.12} minDistance={9} maxDistance={23} minPolarAngle={.15} maxPolarAngle={Math.PI / 2.7} target={[0, 0, 0]}/>}
    </Canvas>
    {!journey && <div className="atlas-camera" aria-label="Map camera controls">
      <button aria-label="Zoom in on India" onClick={() => {controls.current?.dollyIn(1.2); controls.current?.update();}}>+</button>
      <button aria-label="Zoom out of India" onClick={() => {controls.current?.dollyOut(1.2); controls.current?.update();}}>−</button>
      <button aria-label="Reset India map view" onClick={() => controls.current?.reset()}>↺</button>
    </div>}
  </>;
}
