# Measuring performance

Milestone 11. The benchmark is at `#/bench` (Settings → About → Benchmark). It runs the real player and changes nothing you keep. Results stay on the device until you download them.

## On this machine

| Command                                          | Does                                                    |
| ------------------------------------------------ | ------------------------------------------------------- |
| `npm run bench:render`                           | Smoke, headless (software WebGL), on a production build |
| `npm run bench:render -- --gpu --suite=standard` | Chrome with the real GPU                                |
| `npm run bench:render -- --no-gpu --throttle=4`  | Chrome without a GPU, CPU 4×                            |
| `npm run bench:render -- --no-gpu --cores=2`     | the same on 2 cores (the Floor, see below)              |
| `npm run bench:render -- --gpu --idle`           | main thread and processes: playing, paused, Home        |
| `npm run bench:render -- --gpu --trace`          | a 10 s trace of Canon, summed up                        |
| `node scripts/bench-trace.mjs <trace.json[.gz]>` | sums up a trace saved in DevTools                       |
| `node scripts/bench-compare.mjs a.json b.json`   | runs side by side (`--metric=cpu`, `--strip=docs/perf`) |

All options are at the top of `scripts/bench-render.mjs`. `?perf=1` or Ctrl+Alt+P shows the perf overlay.

**Notes**

- Only production builds are comparable (`npm run build`, `npm run preview`); a dev run is flagged.
- DevTools' CPU throttle slows the page's main thread. It doesn't slow the GPU process, where software WebGL draws, so limiting the cores is the better Floor.
- Keep the window in front and don't resize it. A disturbed cell is measured again and the run flagged.
- "Dropped" is longer than 1.5 frames of the screen's rate, judged at 60 Hz on faster screens.

## The Floor by hand

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --disable-gpu --user-data-dir="$env:TEMP\pm-nogpu" http://localhost:4173/pianomeister-online/#/bench
# then DevTools → Performance → CPU: 4× slowdown
```

## Another device

The browser must see a secure address: over plain `http://192.168…` it withholds functions the app needs to open songs.

**On the PC:** `npm run build`, then `npm run preview -- --host`.

**Laptop:** find the PC's address (`ipconfig`) and start Chrome with that origin allowed, in a fresh profile:

```powershell
$pc = "http://192.168.1.10:4173"   # the PC's address
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --unsafely-treat-insecure-origin-as-secure=$pc --user-data-dir="$env:TEMP\pm-bench" "$pc/pianomeister-online/#/bench"
```

**Android:** USB debugging on, plug in, open `chrome://inspect/#devices` on the PC → Port forwarding → `4173` to `localhost:4173` → Enable. On the device open `http://localhost:4173/pianomeister-online/#/bench`.

**Battery drain (Windows laptop):** `scripts/measure-power.ps1`, with nothing else open.
