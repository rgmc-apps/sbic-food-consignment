<template>
  <div class="app-logo" :class="`app-logo--${size}`">
    <img src="/logo-main.png" alt="SBIC Consignment - Food And Beverages" class="app-logo__img" />
    <div v-if="showText" class="app-logo__text">
      <span class="app-logo__title">SBIC Consignment</span>
      <span class="app-logo__sub">Food And Beverages</span>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; showText?: boolean }>(), {
  size: 'md',
  showText: false,
});
</script>

<style scoped>
.app-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-logo__img {
  object-fit: contain;
  flex-shrink: 0;
}

.app-logo--sm .app-logo__img { width: 36px; height: 36px; }
.app-logo--md .app-logo__img { width: 52px; height: 52px; }
.app-logo--lg .app-logo__img { width: 84px; height: 84px; }

.app-logo__text {
  display: flex;
  flex-direction: column;
}

.app-logo__title {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.3px;
  line-height: 1.2;
}

.app-logo__sub {
  font-size: 11px;
  color: var(--app-gold-light);
  letter-spacing: 0.8px;
  text-transform: uppercase;
}
</style>
