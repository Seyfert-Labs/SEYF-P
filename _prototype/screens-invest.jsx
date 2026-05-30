/* UTONOMA — investment screens: Bonos, Detalle, Bóvedas, Convertir */

/* ---------------- BONOS LIST ---------------- */
function ScreenBonos({ go }) {
  const [tab, setTab] = React.useState('gobierno');
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <div className="app-head" style={{ paddingTop: 4 }}>
        <p className="name">Invertir</p>
        <button className="icon-btn"><Icon name="search" size={20}/></button>
      </div>

      <div className="screen-pad">
        <div className="seg" style={{ marginBottom: 18 }}>
          <button className={tab==='gobierno'?'on':''} onClick={() => setTab('gobierno')}>Bonos de gobierno</button>
          <button className={tab==='acciones'?'on':''} onClick={() => setTab('acciones')}>Acciones premium</button>
        </div>

        {tab === 'gobierno' ? (
          <>
            <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', background: 'var(--accent-2-soft)', border: 'none', marginBottom: 16 }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="shield" size={22}/>
              </span>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--txt-muted)', lineHeight: 1.45 }}>
                Deuda soberana respaldada por gobiernos. <b style={{ color: 'var(--txt)' }}>El instrumento más seguro</b> para hacer crecer tu dinero.
              </p>
            </div>

            <p className="eyebrow" style={{ marginBottom: 12 }}>4 países disponibles</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {BONDS.map(b => (
                <div key={b.id} className="card bond-card" onClick={() => go('bono', b)}>
                  <Flag code={b.flag} cls="lg" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{b.country}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--txt-muted)' }}>{b.code} · {b.cur}</p>
                  </div>
                  <Spark data={b.series} w={52} h={30} fillArea />
                  <div className="yield">
                    <div className="pc num">{FMT(b.yield,2)}%</div>
                    <div className="lb">anual</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Cartera curada</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { t: 'NVIDIA', s: 'NVDA · Tecnología', pc: '+1.84%', v: '$2,310.50' },
                { t: 'Apple', s: 'AAPL · Tecnología', pc: '+0.42%', v: '$3,902.10' },
                { t: 'S&P 500 ETF', s: 'VOO · Índice', pc: '+0.61%', v: '$5,140.00' },
                { t: 'Berkshire', s: 'BRK.B · Holding', pc: '−0.18%', v: '$1,980.20', neg: true },
              ].map((s, i) => (
                <div key={i} className="card bond-card">
                  <span style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800 }} className="brand">{s.t[0]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{s.t}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--txt-muted)' }}>{s.s}</p>
                  </div>
                  <div className="yield">
                    <div className="num" style={{ fontWeight: 800, fontSize: 16 }}>{s.v}</div>
                    <div className={`num ${s.neg ? '' : ''}`} style={{ fontSize: 12, fontWeight: 700, color: s.neg ? 'var(--neg)' : 'var(--accent)' }}>{s.pc}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

/* ---------------- BOND DETAIL (inversión / rendimientos) ---------------- */
function ScreenBondDetail({ go, ctx }) {
  const b = ctx || BONDS[0];
  const [range, setRange] = React.useState('1A');
  const proj = (10000 * (b.yield/100)).toFixed(0);
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title={b.country} go={go} back="bonos"
        action={<button className="icon-btn"><Icon name="star" size={20}/></button>} />

      <div className="screen-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Flag code={b.flag} cls="lg" />
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>{b.code}</p>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--txt-muted)' }}>Bono soberano · {b.cur}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 22 }}>
          <span className="det-amount num" style={{ color: 'var(--accent)' }}>{FMT(b.yield,2)}%</span>
          <span style={{ fontSize: 15, color: 'var(--txt-muted)' }}>rendimiento anual</span>
        </div>

        {/* chart */}
        <div className="card" style={{ marginTop: 18, padding: '22px 20px 16px' }}>
          <Spark data={b.series} w={320} h={120} color="var(--accent)" fillArea />
          <div className="seg" style={{ marginTop: 16 }}>
            {['1M','3M','6M','1A','5A'].map(r => (
              <button key={r} className={range===r?'on':''} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>

        {/* key stats */}
        <div className="stat-grid" style={{ marginTop: 16 }}>
          <div className="tile"><div className="k">Riesgo</div><div className="v" style={{ fontSize: 18 }}>{b.risk}</div></div>
          <div className="tile"><div className="k">Calificación</div><div className="v num" style={{ fontSize: 18 }}>{b.rating}</div></div>
          <div className="tile"><div className="k">Plazo</div><div className="v" style={{ fontSize: 16 }}>{b.term}</div></div>
          <div className="tile"><div className="k">Mínimo</div><div className="v num" style={{ fontSize: 18 }}>${b.min} {b.cur}</div></div>
        </div>

        {/* projection */}
        <div className="card" style={{ marginTop: 16, background: 'var(--accent-soft)', border: 'none' }}>
          <p className="eyebrow" style={{ color: 'var(--accent)' }}>Proyección de rendimientos</p>
          <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--txt-muted)', lineHeight: 1.5 }}>
            Si inviertes <b className="num" style={{ color: 'var(--txt)' }}>$10,000</b>, en un año podrías ganar
          </p>
          <p className="num" style={{ fontSize: 34, fontWeight: 700, color: 'var(--accent)', margin: '8px 0 0' }}>+${FMT(+proj,0)}</p>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--txt-muted)', lineHeight: 1.55 }}>{b.desc}</p>
          <div className="divider" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--txt-muted)', fontSize: 13 }}>
            <Icon name="shield" size={16} color="var(--accent)"/> Custodia regulada · liquidación T+1
          </div>
        </div>
      </div>

      {/* sticky CTA */}
      <div style={{ position: 'sticky', bottom: 0, padding: '14px 22px 24px', background: 'linear-gradient(to top, var(--bg) 70%, transparent)' }}>
        <button className="btn btn-primary">Invertir en {b.country}</button>
      </div>
    </div>
  );
}

/* ---------------- BÓVEDAS ---------------- */
function ScreenVaults({ go }) {
  const totalSaved = VAULTS.reduce((s, v) => s + v.bal, 0);
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <div className="app-head" style={{ paddingTop: 4 }}>
        <p className="name">Bóvedas</p>
        <button className="icon-btn"><Icon name="plus" size={22}/></button>
      </div>

      <div className="screen-pad">
        <div className="card glow" style={{ padding: 22 }}>
          <p className="eyebrow">Total ahorrado en bóvedas</p>
          <p className="amount num" style={{ fontSize: 38, marginTop: 12 }}>${FMT(totalSaved,2).split('.')[0]}<span style={{ opacity:.5 }}>.{FMT(totalSaved,2).split('.')[1]}</span></p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <span className="pos-pill"><Icon name="leaf" size={12}/> Rinde hasta 11.2%</span>
            <span className="chip" style={{ pointerEvents: 'none' }}>{VAULTS.length} metas</span>
          </div>
        </div>

        <div className="sec-head"><h3>Tus metas</h3></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {VAULTS.map(v => {
            const pct = Math.round(v.bal / v.goal * 100);
            return (
              <div key={v.id} className="vault card" onClick={() => go('boveda', v)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Ring pct={pct} size={58} color={v.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{v.nm}</p>
                      {v.locked && <Icon name="lock" size={14} color="var(--txt-dim)"/>}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--txt-muted)' }}>{v.note} · {FMT(v.apy,1)}% anual</p>
                    <p className="num" style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 800 }}>
                      ${FMT(v.bal,0)} <span style={{ color: 'var(--txt-dim)', fontWeight: 600 }}>/ ${FMT(v.goal,0)}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          <button className="card" style={{ textAlign: 'center', cursor: 'pointer', borderStyle: 'dashed', color: 'var(--txt-muted)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent' }}>
            <Icon name="plus" size={18}/> Crear nueva bóveda
          </button>
        </div>
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

/* ---------------- VAULT DETAIL ---------------- */
function ScreenVaultDetail({ go, ctx }) {
  const v = ctx || VAULTS[0];
  const pct = Math.round(v.bal / v.goal * 100);
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title={v.nm} go={go} back="bovedas" />
      <div className="screen-pad" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 6px', position: 'relative' }}>
          <Ring pct={pct} size={180} sw={14} color={v.color} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="num" style={{ fontSize: 36, fontWeight: 700 }}>{pct}%</span>
            <span style={{ fontSize: 12, color: 'var(--txt-muted)' }}>de tu meta</span>
          </div>
        </div>

        <p className="num" style={{ fontSize: 28, fontWeight: 800, margin: '14px 0 0' }}>${FMT(v.bal,2)}</p>
        <p style={{ fontSize: 14, color: 'var(--txt-muted)', margin: '4px 0 0' }}>de ${FMT(v.goal,0)} MXN</p>

        <div className="stat-grid" style={{ marginTop: 22, textAlign: 'left' }}>
          <div className="tile"><div className="k">Rendimiento</div><div className="v" style={{ color: 'var(--accent)', fontSize: 20 }}>{FMT(v.apy,1)}%</div></div>
          <div className="tile"><div className="k">Estado</div><div className="v" style={{ fontSize: 16 }}>{v.locked ? 'Bloqueada' : 'Flexible'}</div></div>
        </div>

        <div className="card" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="bolt" size={20}/></span>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--txt-muted)', lineHeight: 1.45 }}>Ahorro automático: <b style={{ color: 'var(--txt)' }}>$1,500</b> cada quincena</p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          <button className="btn btn-primary" style={{ flex: 1 }}><Icon name="plus" size={18}/> Abonar</button>
          <button className="btn btn-ghost" style={{ flex: 1 }}>Retirar</button>
        </div>
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

/* ---------------- CONVERTIR (tipo de cambio Google) ---------------- */
function ScreenConvert({ go }) {
  const [from, setFrom] = React.useState('MXN');
  const usd = 17.1252;
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Convertir" go={go} back="home" />
      <div className="screen-pad">
        <div style={{ position: 'relative' }}>
          <div className="conv-field">
            <span style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }} className="num">$</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--txt-muted)' }}>Pesos mexicanos</p>
              <p className="big num" style={{ margin: '2px 0 0' }}>5,000.00</p>
            </div>
            <span className="chip active" style={{ pointerEvents: 'none' }}>MXN</span>
          </div>
          <div className="conv-swap"><Icon name="swap" size={20}/></div>
          <div className="conv-field">
            <Flag code="us" cls="sm" />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--txt-muted)' }}>Dólar estadounidense</p>
              <p className="big num" style={{ margin: '2px 0 0' }}>292.0<span style={{ opacity:.5 }}>7</span></p>
            </div>
            <span className="chip" style={{ pointerEvents: 'none' }}>USD</span>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="gmatch"><Icon name="globe" size={16} color="var(--accent)"/> Tipo de cambio <b>1 USD = $17.1252</b></div>
          <span className="pos-pill">Igual a Google</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--txt-dim)', margin: '10px 4px 0', lineHeight: 1.5 }}>
          Sin comisiones ocultas ni márgenes. Te damos el tipo de cambio real del mercado, idéntico al que ves en Google.
        </p>

        <div className="sec-head"><h3>Divisas</h3><span className="link" onClick={() => go('cambio')}>Ver todas</span></div>
        <div className="card" style={{ padding: '4px 18px' }}>
          {FX.map(f => (
            <div className="fx-row" key={f.code}>
              <Flag code={f.flag} cls="sm" />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{f.code}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--txt-muted)' }}>{f.nm}</p>
              </div>
              <div className="fx-rate">
                <div className="r num">${FMT(f.rate, f.rate < 1 ? 4 : 4)}</div>
                <div className="d num" style={{ color: f.chg >= 0 ? 'var(--accent)' : 'var(--neg)' }}>{f.chg >= 0 ? '+' : ''}{FMT(f.chg,2)}%</div>
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn-primary" style={{ marginTop: 18 }}>Convertir $5,000 MXN</button>
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

Object.assign(window, { ScreenBonos, ScreenBondDetail, ScreenVaults, ScreenVaultDetail, ScreenConvert });
