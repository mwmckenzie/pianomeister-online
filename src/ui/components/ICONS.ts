/**
 * Our own 24×24 line icons (no icon library). `d` is drawn with a 1.6 px round stroke; `fill`
 * paths are filled instead.
 */
export const ICONS = {
  list: { d: 'M5 7h14M5 12h14M5 17h14' },
  song: { d: 'M9 18V5l11-2v13M3 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0M14 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0' },
  library: { d: 'M5 4v16M10 4v16M15 5l4 15' },
  settings: {
    d: 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8',
  },
  tempo: { d: 'M4 15a8 8 0 1 1 16 0M12 15l4-5M10.8 15a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0' },
  prevBar: { d: 'M6.5 5.5v13', fill: 'M18 6.2v11.6L9.2 12z' },
  nextBar: { d: 'M17.5 5.5v13', fill: 'M6 6.2v11.6l8.8-5.8z' },
  play: { fill: 'M9 6.3v11.4c0 .6.7 1 1.2.7l8.9-5.7c.5-.3.5-1 0-1.3l-8.9-5.8c-.5-.3-1.2 0-1.2.7z' },
  pause: { d: 'M9 6v12M15 6v12' },
  loop: {
    d: 'M5 11V9.5A3.5 3.5 0 0 1 8.5 6H18m-2.5-2.5L18 6l-2.5 2.5M19 13v1.5a3.5 3.5 0 0 1-3.5 3.5H6m2.5 2.5L6 18l2.5-2.5',
  },
  sliders: {
    d: 'M5 7.5h8M17 7.5h2M5 16.5h3M12 16.5h7M15 5.5v4M10 14.5v4',
  },
  close: { d: 'M6.5 6.5l11 11M17.5 6.5l-11 11' },
  reset: { d: 'M5.5 12a6.5 6.5 0 1 0 1.9-4.6M5.5 4.5v3.2h3.2' },
  chevronRight: { d: 'M10 6.5l5.5 5.5-5.5 5.5' },
  chevronLeft: { d: 'M14 6.5L8.5 12l5.5 5.5' },
  chevronDown: { d: 'M6.5 10l5.5 5.5 5.5-5.5' },
  chevronUp: { d: 'M6.5 14l5.5-5.5 5.5 5.5' },
  search: { d: 'M10.5 5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM15 15l4 4' },
  bookmark: { d: 'M7.5 4.5h9v15l-4.5-3.5-4.5 3.5z' },
  bookmarkAdd: { d: 'M7.5 4.5h9v15l-4.5-3.5-4.5 3.5zM12 7.5v5.5M9.25 10.25h5.5' },
  metronome: { d: 'M9.6 4h4.8l3.6 15.5H6zM12 14.5l4-7.5M7.3 15h9.4' },
  stop: { fill: 'M8 7h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z' },
  lock: {
    d: 'M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3',
  },
  plus: { d: 'M12 5v14M5 12h14' },
  arrowDown: { d: 'M12 5v14M7 14l5 5 5-5' },
  arrowUp: { d: 'M12 19V5M7 10l5-5 5 5' },
  check: { d: 'M5.5 12.5l4 4 9-9' },
  toStart: { d: 'M6.5 5.5v13M18 6.5L10 12l8 5.5' },
} as const satisfies Record<string, { readonly d?: string; readonly fill?: string }>
