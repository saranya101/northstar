// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  css: ['~/assets/css/main.css'],

  devtools: {
    enabled: process.env.NUXT_DEVTOOLS === 'true',
  },

  experimental: {
    asyncContext: true,
  },

  vite: {
    optimizeDeps: {
      include: [
        'better-auth/vue',
        'pdfjs-dist/build/pdf.mjs',
        'tesseract.js',
        'zod',
      ],
    },
  },

  modules: ['@nuxt/ui'],

  routeRules: {
    '/app': { ssr: false },
    '/app/**': { ssr: false },
    '/onboarding': { ssr: false },
    '/login': { ssr: false },
    '/signup': { ssr: false },
  },
})
