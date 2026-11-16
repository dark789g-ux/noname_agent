<template>
	<div class="llm-session-marker" :class="`kind-${marker.kind}`">
		<span class="marker-line"></span>
		<span class="marker-pill">
			<span class="marker-icon">{{ marker.icon }}</span>
			<span>{{ marker.label }}</span>
		</span>
		<span class="marker-line"></span>
	</div>
</template>

<script setup lang="ts">
import type { TimelineMarker } from "./types.js";

defineProps<{
	marker: TimelineMarker;
}>();
</script>

<style scoped>
.llm-session-marker, .llm-session-marker div { position: static !important; }
.llm-session-marker { display: flex; align-items: center; gap: 8px; margin: 6px 2px; font-size: 11px; color: #7f8896; }
.marker-line { flex: 1 1 auto; height: 1px; background: #343942; }
.marker-pill { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 999px; background: #262a31; border: 1px solid #383e48; white-space: nowrap; }
.kind-session_rebuild .marker-pill { color: #8ec0ff; border-color: #35587d; background: rgba(74, 158, 255, 0.1); }
.kind-incremental .marker-pill { color: #83d497; border-color: #325e3f; background: rgba(76, 175, 80, 0.08); }
.kind-degraded .marker-pill { color: #ffcc80; border-color: #7c521b; background: rgba(255, 152, 0, 0.1); }
</style>
