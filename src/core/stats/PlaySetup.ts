import type { PracticeConfig } from '../practice/PracticeConfig'

/**
 * The setup in effect during a stretch of play (brief decision 70): tempo %, loop (null = the
 * whole song), hand modes, pre-roll beats and mode, metronome mode. Kept with each play record so
 * the stats page can group plays by setup (roadmap 7.7).
 */
export type PlaySetup = PracticeConfig
