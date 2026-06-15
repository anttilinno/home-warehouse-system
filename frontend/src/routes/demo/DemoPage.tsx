// /demo — standalone dark-terminal dashboard mockup (DEV-only, throwaway).
// Self-contained: a scoped <style> block carries the whole palette as `--t-*`
// CSS vars + `td-*` classes, so this page does NOT read or disturb the global
// Retro OS Pastel tokens. Purpose: validate the dark terminal colors in the
// browser. Rendered full-screen OUTSIDE the AppShell (own topbar + sidebar).

const NAV_GROUPS: Array<{
  heading: string;
  items: Array<[string, string, boolean]>;
}> = [
  {
    heading: "Overview",
    items: [
      ["▦", "Dashboard", true],
      ["▤", "Analytics", false],
    ],
  },
  {
    heading: "Inventory",
    items: [
      ["▣", "Items", false],
      ["⬚", "Inventory", false],
      ["⊞", "Maintenance", false],
      ["▢", "Locations", false],
      ["▥", "Containers", false],
      ["◇", "Categories", false],
      ["↧", "Loans", false],
      ["☺", "Borrowers", false],
    ],
  },
  {
    heading: "System",
    items: [
      ["⌗", "Scan", false],
      ["▦", "Approvals", false],
      ["≋", "My changes", false],
      ["♡", "Wishlist", false],
      ["⊟", "Declutter", false],
      ["⊼", "Imports", false],
    ],
  },
];

// [label, value, sub, tone, icon]
const STAT_CARDS: Array<[string, string, string, string, string]> = [
  ["Item count", "64", "56 units total stock", "green", "▤"],
  ["Active loans", "08", "across 3 departments", "maroon", "⏱"],
  ["Overstock", "05", "action recommended", "blue", "⚠"],
  ["Low stock", "04", "below critical threshold", "red", "⊘"],
];

// [time, action, entity, actor, status, statusTone]
const ACTIVITY: Array<[string, string, string, string, string, string]> = [
  ["14:22:01", "LOAN_INIT", "Power Drill X9", "J. Smith", "SUCCESS", "ok"],
  ["14:18:45", "STOCK_ADD", "Ethernet Cat6", "Warehouse Bot", "QUEUED", "info"],
  ["14:15:20", "MAINT_REQ", "Forklift 02", "A. Chen", "PENDING", "danger"],
  ["14:02:11", "AUDIT_LOG", "Bin 44-A", "System", "SUCCESS", "ok"],
];

const MINI_STATS: Array<[string, string]> = [
  ["Locations", "35"],
  ["Containers", "06"],
  ["Categories", "24"],
  ["Borrowers", "09"],
];

const STYLE = `
.td-root {
  --t-bg:       #060608;
  --t-panel:    #0b0b0e;
  --t-panel-2:  #131317;
  --t-border:   #d7d7dd;
  --t-border-2: #ffffff;
  --t-fg:       #f4f4f6;
  --t-fg-mid:   #cfcfd6;
  --t-fg-dim:   #9a9aa3;

  --green-fill: #0d3326; --green-ink: #3fe3a4; --green-hd: #103a2c;
  --maroon-fill:#311623; --maroon-ink:#ef7593; --maroon-hd:#391a29;
  --blue-fill:  #103247; --blue-ink:  #56b4e4; --blue-hd:  #143a52;
  --red-fill:   #3a141b; --red-ink:   #ff6363; --red-hd:   #431820;

  position: fixed;
  inset: 0;
  overflow: auto;
  background: var(--t-bg);
  color: var(--t-fg);
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 13px;
  display: grid;
  grid-template-columns: 200px 1fr;
  grid-template-rows: 44px 1fr;
  grid-template-areas: "topbar topbar" "sidebar main";
}

/* ---------- Topbar ---------- */
.td-topbar {
  grid-area: topbar;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--t-border);
  background: var(--t-bg);
}
.td-brand { display: flex; align-items: center; gap: 12px; font-weight: 700;
  letter-spacing: 0.06em; font-size: 15px; }
.td-brand b { color: #f4f4f6; text-shadow: 0 0 8px rgba(255,255,255,0.25); }
.td-online { display: inline-flex; align-items: center; gap: 6px; font-size: 10px;
  letter-spacing: 0.1em; color: var(--green-ink); }
.td-online::before { content: ""; width: 6px; height: 6px; border-radius: 50%;
  background: var(--green-ink); box-shadow: 0 0 6px var(--green-ink); }
.td-chip { border: 1px solid var(--t-border-2); padding: 4px 10px; font-size: 10px;
  letter-spacing: 0.1em; color: var(--t-fg-mid); background: var(--t-panel); }
.td-topbar-right { display: flex; align-items: center; gap: 14px;
  font-size: 10px; letter-spacing: 0.08em; color: var(--t-fg-dim); }
.td-iconbtn { width: 28px; height: 28px; display: grid; place-items: center;
  border: 1px solid var(--t-border); color: var(--t-fg-mid); background: var(--t-panel); }

/* ---------- Sidebar ---------- */
.td-sidebar { grid-area: sidebar; border-right: 1px solid var(--t-border);
  background: var(--t-bg); padding: 12px 8px; overflow-y: auto; }
.td-side-head { display: flex; align-items: center; justify-content: space-between;
  padding: 4px 6px 10px; }
.td-side-head .t { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; }
.td-side-head .s { font-size: 9px; color: var(--t-fg-dim); letter-spacing: 0.14em; }
.td-group { margin-top: 14px; }
.td-group > h4 { font-size: 9px; font-weight: 700; letter-spacing: 0.16em;
  color: var(--t-fg-dim); padding: 0 6px 6px; }
.td-nav { display: flex; align-items: center; gap: 10px; padding: 7px 8px;
  font-size: 11px; letter-spacing: 0.06em; color: var(--t-fg-mid);
  border: 1px solid transparent; cursor: pointer; }
.td-nav:hover { color: var(--t-fg); border-color: var(--t-border); }
.td-nav .g { width: 16px; text-align: center; opacity: 0.8; }
.td-nav.active { background: var(--green-fill); color: var(--green-ink);
  border-color: var(--green-ink); }
.td-nav.active .g { opacity: 1; }

/* ---------- Main ---------- */
.td-main { grid-area: main; padding: 18px 22px; overflow-y: auto;
  display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-content: start; }
.td-crumb { grid-column: 1 / -1; font-size: 11px; letter-spacing: 0.1em;
  color: var(--t-fg-dim); }
.td-crumb b { color: var(--t-fg); }

/* ---------- Panels ---------- */
.td-panel { border: 1px solid var(--t-border); background: var(--t-panel); }
.td-panel-hd { display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px; border-bottom: 1px solid var(--t-border);
  background: var(--t-panel-2); font-size: 11px; font-weight: 700;
  letter-spacing: 0.1em; color: var(--t-fg); }
.td-panel-hd .lim { font-size: 9px; color: var(--t-fg-dim); }
.td-panel-bd { padding: 14px; }

/* ---------- Stat cards ---------- */
.td-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.td-card { border: 1px solid var(--t-border); }
.td-card .hd { display: flex; align-items: center; justify-content: space-between;
  padding: 8px 11px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
  color: var(--t-fg-mid); }
.td-card .bd { padding: 6px 11px 14px; }
.td-card .num { font-size: 40px; font-weight: 700; line-height: 1; }
.td-card .sub { margin-top: 8px; font-size: 9px; letter-spacing: 0.08em;
  color: var(--t-fg-dim); }
.td-card.green  { background: var(--green-fill); }
.td-card.green  .hd { background: var(--green-hd); }  .td-card.green  .num { color: var(--green-ink); }
.td-card.maroon { background: var(--maroon-fill); }
.td-card.maroon .hd { background: var(--maroon-hd); } .td-card.maroon .num { color: var(--maroon-ink); }
.td-card.blue   { background: var(--blue-fill); }
.td-card.blue   .hd { background: var(--blue-hd); }   .td-card.blue   .num { color: var(--blue-ink); }
.td-card.red    { background: var(--red-fill); }
.td-card.red    .hd { background: var(--red-hd); }    .td-card.red    .num { color: var(--red-ink); }

/* ---------- Table ---------- */
.td-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.td-table th { text-align: left; padding: 6px 8px; font-size: 9px; font-weight: 700;
  letter-spacing: 0.12em; color: var(--t-fg-dim); border-bottom: 1px solid rgba(255,255,255,0.14); }
.td-table td { padding: 9px 8px; border-bottom: 1px solid rgba(255,255,255,0.08);
  color: var(--t-fg); }
.td-table .actor { color: var(--t-fg-mid); }
.td-action { color: var(--t-fg); font-weight: 600; letter-spacing: 0.04em; }

/* ---------- Pills ---------- */
.td-pill { display: inline-block; padding: 2px 7px; font-size: 9px; font-weight: 700;
  letter-spacing: 0.1em; border: 1px solid currentColor; }
.td-pill.ok     { color: var(--green-ink); background: rgba(54,217,154,0.10); }
.td-pill.info   { color: var(--blue-ink);  background: rgba(74,168,216,0.12); }
.td-pill.danger { color: var(--red-ink);   background: rgba(255,90,90,0.12); }

.td-empty { padding: 26px; text-align: center; color: var(--t-fg-dim);
  font-size: 10px; letter-spacing: 0.08em; }
.td-empty .ic { font-size: 18px; opacity: 0.5; display: block; margin-bottom: 8px; }

/* ---------- Side rail ---------- */
.td-rail { display: flex; flex-direction: column; gap: 16px; }
.td-approve-num { font-size: 34px; font-weight: 700; color: var(--t-fg);
  display: flex; align-items: center; gap: 10px; }
.td-approve-num .p { font-size: 9px; font-weight: 700; letter-spacing: 0.12em;
  border: 1px solid var(--t-border-2); padding: 3px 7px; color: var(--t-fg-mid); }
.td-btn { display: block; width: 100%; margin-top: 12px; padding: 9px;
  border: 1px solid var(--t-border-2); background: var(--t-panel-2);
  color: var(--t-fg); font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
  cursor: pointer; }
.td-btn:hover { border-color: var(--t-fg-mid); }
.td-alert { display: flex; align-items: center; justify-content: space-between;
  padding: 11px; border: 1px solid var(--t-border); margin-bottom: 10px; }
.td-alert .l .t { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; }
.td-alert .l .s { font-size: 9px; color: var(--t-fg-dim); margin-top: 3px; }
.td-alert .v { font-size: 20px; font-weight: 700; color: var(--t-fg); }
.td-mini { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.td-mini > div { border: 1px solid var(--t-border); padding: 12px;
  background: var(--t-panel); text-align: center; }
.td-mini .l { font-size: 9px; letter-spacing: 0.1em; color: var(--t-fg-dim); }
.td-mini .v { font-size: 22px; font-weight: 700; color: var(--t-fg); margin-top: 6px; }
`;

export function DemoPage() {
  return (
    <div className="td-root">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: scoped style for a DEV-only mockup */}
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />

      {/* ---------- Topbar ---------- */}
      <header className="td-topbar">
        <div className="td-brand">
          <b>WAREHOUSE.SYS</b>
          <span className="td-online">ONLINE</span>
          <span className="td-chip">Seed Test Workspace</span>
        </div>
        <div className="td-topbar-right">
          <span>SESSION 00:01:38 · LAST SYNC — LIVE</span>
          <span className="td-iconbtn">☾</span>
          <span className="td-iconbtn">▦</span>
        </div>
      </header>

      {/* ---------- Sidebar ---------- */}
      <nav className="td-sidebar">
        <div className="td-side-head">
          <span className="t">≡ NAVIGATOR</span>
          <span className="s">‹</span>
        </div>
        {NAV_GROUPS.map((group) => (
          <div className="td-group" key={group.heading}>
            <h4>{group.heading}</h4>
            {group.items.map(([glyph, label, active]) => (
              <div className={active ? "td-nav active" : "td-nav"} key={label}>
                <span className="g">{glyph}</span>
                {label}
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* ---------- Main ---------- */}
      <main className="td-main">
        <div className="td-crumb">
          OVERVIEW / <b>DASHBOARD</b>
        </div>

        {/* left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="td-stats">
            {STAT_CARDS.map(([label, value, sub, tone, icon]) => (
              <div className={`td-card ${tone}`} key={label}>
                <div className="hd">
                  <span>{label}</span>
                  <span>{icon}</span>
                </div>
                <div className="bd">
                  <div className="num">{value}</div>
                  <div className="sub">{sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="td-panel">
            <div className="td-panel-hd">
              <span>↻ Recent activity log</span>
              <span className="lim">LIMIT=10</span>
            </div>
            <div className="td-panel-bd" style={{ padding: "0 14px" }}>
              <table className="td-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Actor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ACTIVITY.map(
                    ([time, action, entity, actor, status, tone]) => (
                      <tr key={time}>
                        <td>{time}</td>
                        <td className="td-action">{action}</td>
                        <td>{entity}</td>
                        <td className="actor">{actor}</td>
                        <td>
                          <span className={`td-pill ${tone}`}>{status}</span>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              <div className="td-empty">
                <span className="ic">▤</span>
                Load more activity to sync with central node
              </div>
            </div>
          </div>
        </div>

        {/* right rail */}
        <aside className="td-rail">
          <div className="td-panel">
            <div className="td-panel-hd">
              <span>Pending approvals</span>
            </div>
            <div className="td-panel-bd">
              <div className="td-approve-num">
                16 <span className="p">PENDING</span>
              </div>
              <button type="button" className="td-btn">
                REVIEW QUEUE
              </button>
            </div>
          </div>

          <div className="td-panel">
            <div className="td-panel-hd">
              <span>System alerts</span>
            </div>
            <div className="td-panel-bd">
              <div className="td-alert">
                <div className="l">
                  <div className="t">EXPIRING SOON</div>
                  <div className="s">Item warranties/certificates</div>
                </div>
                <div className="v">08</div>
              </div>
              <div className="td-alert" style={{ marginBottom: 0 }}>
                <div className="l">
                  <div className="t">MAINTENANCE DUE</div>
                  <div className="s">Nothing due at this time</div>
                </div>
                <div className="v">0</div>
              </div>
            </div>
          </div>

          <div className="td-mini">
            {MINI_STATS.map(([label, value]) => (
              <div key={label}>
                <div className="l">{label}</div>
                <div className="v">{value}</div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
