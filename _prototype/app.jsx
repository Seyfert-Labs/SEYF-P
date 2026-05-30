/* UTONOMA — app shell: router, tab bar, tweaks, device stage */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "estilo": "expresivo",
  "palette": ["#C8FF4D", "#8B5CF6"]
}/*EDITMODE-END*/;

const PALETTES = [
  ["#C8FF4D", "#8B5CF6"], // Lima + Violeta
  ["#3DF5A0", "#7C83FF"], // Esmeralda + Índigo
  ["#D6FF3D", "#B85CFF"], // Lima ácida + Magenta
];

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

const TABS = [
  { id: 'inicio',  ic: 'home',   lb: 'Inicio',  screen: 'home',    match: ['home','wallet','convertir','cambio','notifs','txn'] },
  { id: 'invertir',ic: 'invest', lb: 'Invertir', screen: 'bonos',   match: ['bonos','bono'] },
  { id: 'bovedas', ic: 'vault',  lb: 'Bóvedas',  screen: 'bovedas', match: ['bovedas','boveda'] },
  { id: 'tarjeta', ic: 'card',   lb: 'Tarjeta',  screen: 'card',    match: ['card'] },
  { id: 'perfil',  ic: 'user',   lb: 'Perfil',   screen: 'perfil',  match: ['perfil'] },
];

function TabBar({ screen, go }) {
  return (
    <div className="tabbar">
      {TABS.map(t => {
        const active = t.match.includes(screen);
        return (
          <button key={t.id} className={`tab ${active ? 'active' : ''}`} onClick={() => go(t.screen)}>
            <Icon name={t.ic} size={24} stroke={active ? 2.4 : 2} />
            <span className="lb">{t.lb}</span>
          </button>
        );
      })}
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [entered, setEntered] = React.useState(false);
  const [route, setRoute] = React.useState({ screen: 'home', ctx: null });
  const [scale, setScale] = React.useState(1);

  const go = React.useCallback((screen, ctx = null) => {
    setRoute({ screen, ctx });
    // scroll active screen to top on nav
    requestAnimationFrame(() => {
      const el = document.querySelector('.screen');
      if (el) el.scrollTop = 0;
    });
  }, []);

  React.useEffect(() => {
    const fit = () => {
      const m = 24;
      const s = Math.min(1, (window.innerHeight - m) / 874, (window.innerWidth - m) / 402);
      setScale(s);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const [acc, acc2] = t.palette || PALETTES[0];
  const rootVars = {
    '--accent': acc,
    '--accent-2': acc2,
    '--pos': acc,
    '--on-accent': '#0A0A0F',
    '--accent-soft': hexA(acc, 0.15),
    '--accent-2-soft': hexA(acc2, 0.18),
  };

  const SCREENS = {
    home:      <ScreenHome go={go} />,
    wallet:    <ScreenWallet go={go} />,
    bonos:     <ScreenBonos go={go} />,
    bono:      <ScreenBondDetail go={go} ctx={route.ctx} />,
    bovedas:   <ScreenVaults go={go} />,
    boveda:    <ScreenVaultDetail go={go} ctx={route.ctx} />,
    card:      <ScreenCard go={go} />,
    perfil:    <ScreenProfile go={go} />,
    convertir: <ScreenConvert go={go} />,
    cambio:    <ScreenConvert go={go} />,
    notifs:    <ScreenProfile go={go} />,
    txn:       <ScreenWallet go={go} />,
  };

  const showTabs = !['bono','boveda','convertir','cambio','txn'].includes(route.screen);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
          <IOSDevice dark>
            <div className={`uto-root style-${t.estilo}`} style={rootVars} key={route.screen}>
              {!entered
                ? <Onboarding onDone={() => setEntered(true)} />
                : (
                  <>
                    {SCREENS[route.screen] || SCREENS.home}
                    {showTabs && <TabBar screen={route.screen} go={go} />}
                  </>
                )}
            </div>
          </IOSDevice>
        </div>
      </div>

      <TweaksPanel>
        <TweakSection label="Estilo visual" />
        <TweakRadio label="Dirección" value={t.estilo}
          options={['minimalista', 'expresivo']}
          onChange={(v) => setTweak('estilo', v)} />
        <TweakSection label="Paleta morado / verde" />
        <TweakColor label="Acentos" value={t.palette}
          options={PALETTES}
          onChange={(v) => setTweak('palette', v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
