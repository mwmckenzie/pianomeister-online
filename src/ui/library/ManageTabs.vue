<script setup lang="ts">
/** The Library | Bookmarks tabs at the top of both pages (brief decision 73). */
defineProps<{ readonly active: 'library' | 'bookmarks' }>()
</script>

<template>
  <nav class="tabs" aria-label="Manage">
    <RouterLink
      :to="{ name: 'library' }"
      class="tab"
      :class="{ active: active === 'library' }"
      :aria-current="active === 'library' ? 'page' : undefined"
      data-testid="tab-library"
      >Library</RouterLink
    >
    <RouterLink
      :to="{ name: 'bookmarks' }"
      class="tab"
      :class="{ active: active === 'bookmarks' }"
      :aria-current="active === 'bookmarks' ? 'page' : undefined"
      data-testid="tab-bookmarks"
      >Bookmarks</RouterLink
    >
  </nav>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-shrink: 0;
  padding: 3px;
  border-radius: var(--radius-md);
  background: var(--field);
}

.tab {
  padding: 8px 16px;
  border-radius: 9px;
  color: var(--text-2);
  font-size: var(--text-md);
  text-decoration: none;
}

.tab:hover {
  color: var(--text-1);
}

.tab.active {
  background: rgb(var(--primary-rgb) / 22%);
  color: var(--text-strong);
  font-weight: var(--weight-medium);
}
</style>
