<template>
  <button
    type="button"
    class="collapse-btn"
    :title="expand ? 'Expand all' : 'Collapse all'"
    @click="$emit('click')"
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
      <path d="M5 2h9v9M2 5h9v9H2zM4 9.5h5" />
      <path v-if="expand" d="M6.5 7v5" />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  expand?: boolean
}>()

defineEmits<{
  click: []
}>()
</script>

<style scoped>
.collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--vscode-tab-inactiveForeground);
  border-radius: 0;
  cursor: pointer;
  transition: color 0.2s ease;
}

.collapse-btn:hover {
  color: var(--vscode-tab-activeForeground);
}
</style>
