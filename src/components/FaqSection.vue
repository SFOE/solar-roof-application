<!--
  FaqSection.vue
  Accordion-style FAQ section with expandable questions.
-->

<template>
  <div id="faq" class="faq-section">
    <h3>{{ $t('faq_title') }}</h3>

    <div class="faq-item" v-for="(item, index) in faqItems" :key="index">
      <button class="faq-question" @click="toggle(index)" :aria-expanded="openIndices.has(index)">
        <span>{{ item.question }}</span>
        <span class="faq-icon">{{ openIndices.has(index) ? '−' : '+' }}</span>
      </button>
      <div v-if="openIndices.has(index)" class="faq-answer" v-html="item.answer"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const openIndices = ref<Set<number>>(new Set())

function toggle(index: number) {
  if (openIndices.value.has(index)) {
    openIndices.value.delete(index)
  } else {
    openIndices.value.add(index)
  }
  // Force reactivity
  openIndices.value = new Set(openIndices.value)
}

const faqItems = computed(() => [
  { question: t('faq_q1'), answer: t('faq_a1') },
  { question: t('faq_q2'), answer: t('faq_a2') },
  { question: t('faq_q3'), answer: t('faq_a3') },
  { question: t('faq_q4'), answer: t('faq_a4') },
  { question: t('faq_q5'), answer: t('faq_a5') },
  { question: t('faq_q6'), answer: t('faq_a6') },
  { question: t('faq_q7'), answer: t('faq_a7') },
  { question: t('faq_q8'), answer: t('faq_a8') },
])
</script>

<style scoped>
.faq-section {
  margin: 2rem 0 1rem;
  padding: 1.5rem;
  background: #f8f8f8;
  border-radius: 6px;
}

.faq-section h3 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  color: #333;
}

.faq-item {
  border-bottom: 1px solid #e0e0e0;
}

.faq-item:last-child {
  border-bottom: none;
}

.faq-question {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.75rem 0;
  background: none;
  border: none;
  font-size: 0.92rem;
  font-weight: 600;
  color: #333;
  cursor: pointer;
  text-align: center;
}

.faq-question:hover {
  color: #d32f2f;
}

.faq-icon {
  font-size: 1.2rem;
  font-weight: 300;
  color: #666;
  flex-shrink: 0;
  margin-left: 1rem;
}

.faq-answer {
  padding: 0 0 1rem;
  font-size: 0.88rem;
  line-height: 1.6;
  color: #555;
  text-align: justify;
}

.faq-answer :deep(a) {
  color: #1565c0;
  text-decoration: none;
  font-weight: 500;
}

.faq-answer :deep(a:hover) {
  text-decoration: underline;
}

.faq-answer :deep(p) {
  margin: 0.3rem 0;
}

.faq-answer :deep(img) {
  max-width: 100%;
  margin: 0.5rem 0;
  border-radius: 4px;
}
</style>
