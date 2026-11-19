import { pngResponse } from "@/lib/draw-png";
import { cardFont } from "@/lib/draw/fonts";
import { buttonBounds, MENUS, tabBounds, TAB_ORDER, type MenuIcon, type MenuSpec } from "@/lib/line/rich-menu";

/**
 * The picture a menu's tabs and buttons are cut from (owner chose ค, 2026-11-19): the app's
 * navy, the tab that is showing underlined in the logo's terracotta, and one button a tab in
 * terracotta for where most agents are going.
 *
 * No emoji: the drawing library has no colour font. The icons are drawn as plain strokes.
 */
const font = cardFont;

const C = {
  ground: "#022162",
  tabOff: "#01143d",
  tabOffInk: "#9fb2de",
  tile: "#0d2f78",
  ink: "#ffffff",
  sub: "#c7d3f0",
  icon: "#f2b49c",
  lead: "#d97757",
  leadSub: "#fff1ea",
};

/** the gap between two buttons, drawn as the navy ground showing through */
const GUTTER = 16;
const UNDERLINE = 22;

/** Each icon as 24-unit strokes; `fill` marks a shape drawn solid. */
const ICONS: Record<MenuIcon, { d: string; fill?: true }[]> = {
  life: [{ d: "M3 17l5-5 4 3 8-8" }, { d: "M15 7h5v5" }],
  health: [{ d: "M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z" }],
  shield: [{ d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" }, { d: "M8.5 12l2.5 2.5 4.5-5" }],
  legacy: [{ d: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" }],
  pa: [{ d: "M3 12a9 9 0 0 1 18 0z" }, { d: "M12 12v6a2 2 0 0 1-4 0" }],
  grid: [
    { d: "M5.5 4h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 4 9.5v-4A1.5 1.5 0 0 1 5.5 4z" },
    { d: "M14.5 4h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 9.5v-4A1.5 1.5 0 0 1 14.5 4z" },
    { d: "M5.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 4 18.5v-4A1.5 1.5 0 0 1 5.5 13z" },
    { d: "M14.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5z" },
  ],
  video: [{ d: "M5 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" }, { d: "M16 10l5-3v10l-5-3z" }],
  story: [{ d: "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" }, { d: "M10 9l5 3-5 3z", fill: true }],
  spark: [{ d: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" }],
  bell: [{ d: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" }, { d: "M10 20a2 2 0 0 0 4 0" }],
  play: [{ d: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z" }, { d: "M10 8.5l5 3.5-5 3.5z", fill: true }],
  wallet: [{ d: "M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" }, { d: "M3 10h18M16 14.5h2" }],
};

function Icon({ name, color, size }: { name: MenuIcon; color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {ICONS[name].map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill ? color : "none"}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export async function drawMenu(menu: MenuSpec): Promise<Response> {
  const [regular, semibold] = await Promise.all([
    font("IBMPlexSansThai-Regular.ttf"),
    font("IBMPlexSansThai-SemiBold.ttf"),
  ]);
  const tabs = tabBounds(menu);
  const cells = buttonBounds(menu);

  return pngResponse(
    (
      <div style={{ display: "flex", position: "relative", width: menu.width, height: menu.height, background: C.ground }}>
        {tabs.map((b, i) => {
          const on = TAB_ORDER[i] === menu.name;
          return (
            <div
              key={`tab-${i}`}
              style={{
                position: "absolute", left: b.x, top: b.y, width: b.width, height: b.height,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: on ? C.ground : C.tabOff,
                borderBottom: on ? `${UNDERLINE}px solid ${C.lead}` : `${UNDERLINE}px solid ${C.tabOff}`,
                fontFamily: "Plex", fontWeight: 600, fontSize: 92, color: on ? C.ink : C.tabOffInk,
              }}
            >
              {MENUS[TAB_ORDER[i]].tab}
            </div>
          );
        })}
        {cells.map((b, i) => {
          const { title, sub, icon, lead } = menu.buttons[i];
          return (
            <div
              key={`b-${i}`}
              style={{
                position: "absolute", left: b.x + GUTTER, top: b.y + GUTTER,
                width: b.width - GUTTER * 2, height: b.height - GUTTER * 2,
                display: "flex", flexDirection: "column", justifyContent: "center",
                padding: "0 64px", borderRadius: 56,
                background: lead ? C.lead : C.tile,
              }}
            >
              <Icon name={icon} color={lead ? C.ink : C.icon} size={150} />
              <div style={{
                display: "flex", marginTop: 30, fontFamily: "Plex", fontWeight: 600, fontSize: 100, lineHeight: 1.15, color: C.ink,
              }}>
                {title}
              </div>
              <div style={{
                display: "flex", marginTop: 14, fontFamily: "Plex", fontWeight: 400, fontSize: 64, lineHeight: 1.3,
                color: lead ? C.leadSub : C.sub,
              }}>
                {sub}
              </div>
            </div>
          );
        })}
      </div>
    ),
    {
      width: menu.width,
      height: menu.height,
      fonts: [
        { name: "Plex", data: regular, weight: 400, style: "normal" },
        { name: "Plex", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
