/* UTONOMA — shared layout helpers */

/* top bar with greeting + actions (home-style) */
function TopBar({ go }) {
  return (
    <div className="app-head">
      <div>
        <p className="greet">Buenas tardes</p>
        <p className="name">Diego Robles</p>
      </div>
      <div className="head-actions">
        <button className="icon-btn" onClick={() => go('notifs')} aria-label="Notificaciones">
          <Icon name="bell" size={20} />
        </button>
        <button className="avatar" onClick={() => go('perfil')}>DR</button>
      </div>
    </div>
  );
}

/* sub-page header: back + title + optional action */
function SubHeader({ title, go, back = 'home', action }) {
  return (
    <div className="app-head" style={{ paddingTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="icon-btn" onClick={() => go(back)} aria-label="Atrás">
          <Icon name="chevL" size={20} />
        </button>
        <p className="name" style={{ fontSize: 20 }}>{title}</p>
      </div>
      {action || <span style={{ width: 42 }} />}
    </div>
  );
}

/* a money figure with currency */
function Money({ amount, cur = 'MXN', sign = false, size = 'inherit', cents = true }) {
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const s = sign ? (neg ? '−' : '+') : (neg ? '−' : '');
  const [int, dec] = FMT(abs, cents ? 2 : 0).split('.');
  return (
    <span className="num" style={{ fontSize: size }}>
      {s}${int}{cents && <span style={{ opacity: .5 }}>.{dec}</span>}
      <span style={{ fontSize: '0.62em', opacity: .55, marginLeft: 5, fontWeight: 600 }}>{cur}</span>
    </span>
  );
}

/* transaction / list row */
function TxnRow({ t, go }) {
  const pos = t.amt > 0;
  return (
    <div className="lrow" onClick={() => go && go('txn', t)}>
      <div className="ava" style={pos ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'transparent' } : {}}>
        <Icon name={t.ic} size={20} />
      </div>
      <div className="mid">
        <p className="ti">{t.nm}</p>
        <p className="su">{t.su}</p>
      </div>
      <div className="amt">
        <div className="a" style={{ color: pos ? 'var(--accent)' : 'var(--txt)' }}>
          <Money amount={t.amt} cur={t.cur || 'MXN'} sign={pos} />
        </div>
        {t.sub && <div className="s num">{t.sub}</div>}
      </div>
    </div>
  );
}

Object.assign(window, { TopBar, SubHeader, Money, TxnRow });
