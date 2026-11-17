<script setup lang="ts">
const version = __APP_VERSION__
</script>

<template>
  <section class="about" aria-label="About">
    <p class="name">
      PianoMeister Online <span class="version">version {{ version }}</span>
    </p>
    <p class="text">
      A piano practice visualizer: songs scroll down a note highway to a 3D keyboard, with bar-based
      practice tools. Everything stays in this browser; nothing is uploaded.
    </p>
    <h3 class="section-caps">Credits</h3>
    <ul class="text">
      <li>Piano: Splendid Grand Piano samples (public domain), played with smplr (MIT).</li>
      <li>MIDI parsing: @tonejs/midi (MIT). 3D: three.js (MIT). UI primitives: Reka UI (MIT).</li>
      <li>Font: Inter Tight (SIL Open Font License 1.1).</li>
    </ul>
    <p class="text">Full credits are in docs/CREDITS.md in the source repository.</p>
  </section>
</template>

<style scoped>
.about {
  padding-bottom: var(--space-6);
}

.name {
  margin: var(--space-2) 0;
  font-size: var(--text-lg);
}

.version {
  margin-left: var(--space-2);
  color: var(--text-3);
  font-size: var(--text-md);
}

.text {
  color: var(--text-2);
  line-height: 1.5;
}

ul {
  padding-left: 1.2em;
}
</style>
