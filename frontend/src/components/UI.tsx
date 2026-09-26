import {useEffect, useRef, ReactNode} from 'react';
const paths: Record<string,string> = {
 auto_awesome:'M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm7 14 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z',
 delete_sweep:'M5 6h14m-9 4v7m4-7v7M7 6l1 15h8l1-15M9 6V3h6v3',
 error_outline:'M12 8v5m0 4h.01M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z',
 send:'m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13',
 travel_explore:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-3 3-3 15 0 18m0-18c3 3 3 15 0 18m6 5 4 4',
 compass_calibration:'M12 2v4m0 12v4M2 12h4m12 0h4M12 8l3 3-3 5-3-5 3-3Z',
 gavel:'m4 20 8-8m-5-7 4-4 9 9-4 4L7 5Zm-3 15h10',
 local_police:'m12 2 8 4v5c0 5-3 9-8 11-5-2-8-6-8-11V6l8-4Z',
 edit:'m4 16 12-12 4 4L8 20H4v-4Zm10-10 4 4', picture_as_pdf:'M6 2h8l4 4v16H6V2Zm8 0v5h5M8 17h2v-5H8v8m5-8v8h2a2 4 0 0 0 0-8h-2', content_cut:'M8 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM7 9l14 12M7 15 21 3',
 settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 desktop:'M3 3h18v13H3V3Zm9 13v5m-5 0h10',
 explore:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 8l-3 5-5 3 3-5 5-3Z',
 home:'m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7',
 person:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 5 0 0 1 16 0v3',
 search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6',
 close:'m6 6 12 12M6 18 18 6',
 arrow_forward:'M4 12h16m-6-6 6 6-6 6', north_east:'M6 18 18 6M6 6h12v12', south_east:'m6 6 12 12M6 18h12V6', south:'M12 3v18m-6-6 6 6 6-6', north:'M12 21V3m-6 6 6-6 6 6', chevron_right:'m9 5 7 7-7 7',
 bookmark_border:'M6 3h12v18l-6-4-6 4V3Z', bookmark_added:'M6 3h12v18l-6-4-6 4V3Zm3 6 2 2 4-4', bookmark_add:'M6 3h12v18l-6-4-6 4V3Zm3 6h6m-3-3v6',
 landscape:'m2 20 7-15 6 11 3-6 4 10H2Zm4-8 3 2 3-2', forest:'m12 2-7 7h3l-5 7h7v6h4v-6h7l-5-7h3L12 2Z', water:'M2 6q3-4 6 0t6 0 6 0M2 12q3-4 6 0t6 0 6 0M2 18q3-4 6 0t6 0 6 0',
 temple_hindu:'M3 21h18M5 21V11h14v10M3 11h18M6 11l6-8 6 8M9 21v-6h6v6M12 3V1', pets:'M8 17q4-8 8 0c4 6-4 3-4 3s-8 3-4-3ZM5 10a2 3 0 1 1 0-1Zm5-5a2 3 0 1 1 0-1Zm6 0a2 3 0 1 1 0-1Zm5 5a2 3 0 1 1 0-1Z', dark_mode:'M20 14A9 9 0 1 1 10 3a7 7 0 0 0 10 11Z',
 map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16', route:'M4 6h12a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h12M4 6l3-3M4 6l3 3M20 22l-3-3',
 location_on:'M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0ZM14 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z', schedule:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 6v6l4 3',
 public:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-6 6-6 12 0 18 6-6 6-12 0-18Z', eco:'M20 3C3 1 1 11 6 17S23 19 20 3ZM4 21l12-13',
 tune:'M3 6h7m4 0h7M3 12h12m4 0h2M3 18h3m4 0h11M10 3v6m5 0v6m-9 0v6', grid_view:'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
 auto_stories:'M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1Zm0 0v16', verified:'m12 2 3 3 4 1 1 4 2 2-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-2 1-4 4-1 3-3Zm-5 10 3 3 7-7', workspace_premium:'M18 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM8 13l-2 9 6-3 6 3-2-9',
 shield:'m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z', lock:'M5 10h14v11H5V10Zm3 0V6a4 4 0 0 1 8 0v4m-4 4v3', fingerprint:'M4 13V9a8 8 0 0 1 16 0v6M8 20V9a4 4 0 0 1 8 0v8m-4-8v13M4 17v3',
 download:'M12 2v13m-5-5 5 5 5-5M3 15v6h18v-6', info:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6m0-10v1', check_circle:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM7 12l3 3 7-7', add:'M12 4v16M4 12h16',
 sunny:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2', cloud:'M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5 5 0 0 1 0 11H6Z', rainy:'M6 15a5 5 0 0 1-1-10 7 7 0 0 1 13 2 4 4 0 0 1 0 8M7 18l-2 4m8-4-2 4m8-4-2 4',
 my_location:'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM12 2v4m0 12v4M2 12h4m12 0h4M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z', payments:'M2 5h20v14H2V5Zm13 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 9v6m14-6v6',
 hiking:'M14 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM10 9l-3 5 5 2-4 6m4-6 4 6M10 9l5 4h4M19 9v13M6 8l-3 6', open_in_new:'M13 3h8v8m0-8L10 14M9 3H3v18h18v-6',
 bed:'M2 21V7m0 10h20V9H9v8M2 12h7V7H2m20 10v4', restaurant:'M4 2v7a3 3 0 0 0 6 0V2M7 2v20M20 2c-5 3-5 8 0 10V2Zm0 10v10', group:'M10 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM1 21v-4a6 4 0 0 1 12 0v4M17 4a3 3 0 0 1 0 6m0 4a6 4 0 0 1 6 4v3', calendar_month:'M3 5h18v16H3V5Zm0 5h18M7 2v6m10-6v6M7 14h2m6 0h2m-10 4h2m6 0h2', luggage:'M5 6h14v14H5V6Zm4 0V2h6v4M9 10v6m6-6v6M7 20v2m10-2v2'
};
export function Icon({name, className = ''}: {name: string; className?: string}) {return <span aria-hidden="true" className={'material-symbols-outlined ' + className}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || (['partly_cloudy_day','foggy','weather_snowy','thunderstorm'].includes(name)?paths.cloud:paths.explore)}/></svg></span>;}
export function Modal({children, onClose, title, wide = false}: {children: ReactNode; onClose: () => void; title: string; wide?: boolean}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {const el = ref.current!; el.showModal(); const old = document.body.style.overflow; document.body.style.overflow='hidden'; return () => {document.body.style.overflow=old;el.close();};}, []);
  return <dialog ref={ref} className={'modal ' + (wide ? 'wide' : '')} aria-label={title} onCancel={onClose} onClick={e => {if(e.target===ref.current) onClose();}}><button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}><Icon name="close"/></button>{children}</dialog>;
}
export function Progress({xp, floor, next}: {xp: number; floor: number; next: number | null}) {return <div className="progress" role="progressbar" aria-label="Travel tier progress" aria-valuemin={floor} aria-valuemax={next || xp} aria-valuenow={xp}><span style={{width: `${next ? Math.min(100, (xp-floor)/(next-floor)*100) : 100}%`}}/></div>;}
