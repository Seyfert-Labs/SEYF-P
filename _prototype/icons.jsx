/* UTONOMA — icon set + shared UI primitives (exported to window) */

function Icon({ name, size = 22, stroke = 2, color = 'currentColor', fill = 'none' }) {
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    bell:   <><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" {...p}/><path d="M10.5 20a2 2 0 003 0" {...p}/></>,
    gear:   <><circle cx="12" cy="12" r="3.2" {...p}/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" {...p}/></>,
    plus:   <path d="M12 5v14M5 12h14" {...p}/>,
    send:   <><path d="M12 19V6" {...p}/><path d="M6 11l6-6 6 6" {...p}/></>,
    recv:   <><path d="M12 5v13" {...p}/><path d="M6 13l6 6 6-6" {...p}/></>,
    leaf:   <><path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14-1 0-1-1-1-1z" {...p}/><path d="M9 15c2-3 5-5 8-6" {...p}/></>,
    swap:   <><path d="M7 4v13M7 4L4 7M7 4l3 3" {...p}/><path d="M17 20V7M17 20l3-3M17 20l-3-3" {...p}/></>,
    card:   <><rect x="2.5" y="5" width="19" height="14" rx="3" {...p}/><path d="M2.5 9.5h19" {...p}/></>,
    chart:  <><path d="M4 19V5M4 19h16" {...p}/><path d="M8 16l3-4 3 2 4-6" {...p}/></>,
    lock:   <><rect x="5" y="10" width="14" height="10" rx="2.5" {...p}/><path d="M8 10V7a4 4 0 018 0v3" {...p}/></>,
    shield: <><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" {...p}/><path d="M9 12l2 2 4-4" {...p}/></>,
    finger: <><path d="M12 11v3a5 5 0 01-1.5 3.5" {...p}/><path d="M8.5 7.5a5 5 0 017 1.5" {...p}/><path d="M6.5 12a6.5 6.5 0 0111-4.7" {...p}/><path d="M15.5 12v2a8 8 0 01-.6 3" {...p}/></>,
    eye:    <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" {...p}/><circle cx="12" cy="12" r="3" {...p}/></>,
    chevR:  <path d="M9 6l6 6-6 6" {...p}/>,
    chevL:  <path d="M15 6l-6 6 6 6" {...p}/>,
    chevD:  <path d="M6 9l6 6 6-6" {...p}/>,
    check:  <path d="M5 12l4.5 4.5L19 7" {...p}/>,
    bag:    <><path d="M6 8h12l-1 12H7L6 8z" {...p}/><path d="M9 8V6a3 3 0 016 0v2" {...p}/></>,
    music:  <><path d="M9 18V6l10-2v10" {...p}/><circle cx="6.5" cy="18" r="2.5" {...p}/><circle cx="16.5" cy="14" r="2.5" {...p}/></>,
    car:    <><path d="M4 13l2-5h12l2 5" {...p}/><path d="M3 13h18v5H3z" {...p}/><circle cx="7" cy="18" r="1.4" {...p}/><circle cx="17" cy="18" r="1.4" {...p}/></>,
    cup:    <><path d="M5 8h12v4a6 6 0 01-12 0V8z" {...p}/><path d="M17 9h2a2 2 0 010 4h-2" {...p}/><path d="M7 3v2M11 3v2" {...p}/></>,
    bed:    <><path d="M3 18v-6h18v6M3 12V7M21 18v-2M3 18v-2" {...p}/><path d="M3 12h18" {...p}/><path d="M7 12V9.5a1.5 1.5 0 011.5-1.5h7A1.5 1.5 0 0117 9.5V12" {...p}/></>,
    home:   <><path d="M4 11l8-7 8 7" {...p}/><path d="M6 10v10h12V10" {...p}/></>,
    invest: <><path d="M4 19V5M4 19h16" {...p}/><path d="M8 15l3-3 2.5 2L19 8" {...p}/></>,
    vault:  <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" {...p}/><circle cx="12" cy="12" r="3.5" {...p}/><path d="M12 4.5v2M12 17.5v2" {...p}/></>,
    user:   <><circle cx="12" cy="8.5" r="3.5" {...p}/><path d="M5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5" {...p}/></>,
    search: <><circle cx="11" cy="11" r="6.5" {...p}/><path d="M20 20l-3.5-3.5" {...p}/></>,
    freeze: <><path d="M12 3v18M5 7l14 10M19 7L5 17" {...p}/><path d="M12 3l-2 2.5M12 3l2 2.5M12 21l-2-2.5M12 21l2-2.5" {...p}/></>,
    qr:     <><rect x="4" y="4" width="6" height="6" rx="1" {...p}/><rect x="14" y="4" width="6" height="6" rx="1" {...p}/><rect x="4" y="14" width="6" height="6" rx="1" {...p}/><path d="M14 14h2v2M20 14v6M16 18h4M18 14v1" {...p}/></>,
    arrowR: <path d="M5 12h14M13 6l6 6-6 6" {...p}/>,
    bolt:   <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" {...p}/>,
    globe:  <><circle cx="12" cy="12" r="9" {...p}/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" {...p}/></>,
    info:   <><circle cx="12" cy="12" r="9" {...p}/><path d="M12 11v5M12 8h.01" {...p}/></>,
    clock:  <><circle cx="12" cy="12" r="9" {...p}/><path d="M12 7v5l3.5 2" {...p}/></>,
    star:   <path d="M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17.8 6.4 20l1.2-6.2L3 9.5l6.3-.8L12 3z" {...p}/>,
    doc:    <><path d="M6 3h8l4 4v14H6z" {...p}/><path d="M14 3v4h4M9 13h6M9 17h6" {...p}/></>,
    headset:<><path d="M5 13v-1a7 7 0 0114 0v1" {...p}/><rect x="3.5" y="13" width="3.5" height="6" rx="1.5" {...p}/><rect x="17" y="13" width="3.5" height="6" rx="1.5" {...p}/><path d="M19 19a4 4 0 01-4 3h-2" {...p}/></>,
    logout: <><path d="M14 4H6v16h8" {...p}/><path d="M10 12h10M16 8l4 4-4 4" {...p}/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} style={{ display: 'block' }}>
      {paths[name] || null}
    </svg>
  );
}

/* circular flags (simplified, recognizable) */
function Flag({ code, cls = '' }) {
  const flags = {
    mx: <svg viewBox="0 0 36 36"><rect width="12" height="36" x="0" fill="#0a6b3b"/><rect width="12" height="36" x="12" fill="#f4f4f4"/><rect width="12" height="36" x="24" fill="#c8102e"/><circle cx="18" cy="18" r="3.4" fill="#7a5230"/></svg>,
    us: <svg viewBox="0 0 36 36"><rect width="36" height="36" fill="#f4f4f4"/>{[0,2,4,6,8,10,12].map(i=><rect key={i} y={i*36/13} width="36" height={36/13} fill="#b22234"/>)}<rect width="17" height={36/13*7} fill="#3c3b6e"/></svg>,
    br: <svg viewBox="0 0 36 36"><rect width="36" height="36" fill="#1b9e3e"/><path d="M18 5L33 18 18 31 3 18z" fill="#ffd200"/><circle cx="18" cy="18" r="6.2" fill="#1e3a8a"/></svg>,
    kr: <svg viewBox="0 0 36 36"><rect width="36" height="36" fill="#f4f4f4"/><path d="M18 12a6 6 0 010 12 6 6 0 000-12z" fill="#c8102e"/><path d="M18 12a6 6 0 000 12 6 6 0 010-12z" fill="#0047a0"/></svg>,
    eu: <svg viewBox="0 0 36 36"><rect width="36" height="36" fill="#0047a0"/>{Array.from({length:12}).map((_,i)=>{const a=i*30*Math.PI/180;return <circle key={i} cx={18+9*Math.sin(a)} cy={18-9*Math.cos(a)} r="1.5" fill="#ffd200"/>;})}</svg>,
  };
  return <div className={`flag ${cls}`}>{flags[code] || <svg viewBox="0 0 36 36"><rect width="36" height="36" fill="#444"/></svg>}</div>;
}

/* sparkline */
function Spark({ data, w = 90, h = 34, color = 'var(--accent)', fillArea = false }) {
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => [ (i/(data.length-1))*w, h - ((v-min)/rng)*(h-4) - 2 ]);
  const d = pts.map((p, i) => `${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L${w} ${h} L0 ${h} Z`;
  const gid = 'sg' + Math.round(w*h*data[0]);
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {fillArea && <><defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity="0.28"/><stop offset="1" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs><path d={area} fill={`url(#${gid})`}/></>}
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* progress ring */
function Ring({ pct, size = 64, sw = 7, color = 'var(--accent)' }) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r, off = c * (1 - pct/100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={sw}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size/2} ${size/2})`}/>
    </svg>
  );
}

Object.assign(window, { Icon, Flag, Spark, Ring });
