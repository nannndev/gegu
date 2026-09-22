/**
 * Vercel Analytics — client-only plugin.
 *
 * Memanggil `inject()` satu kali saat aplikasi dimuat. Di luar Vercel
 * (misalnya `npm run dev` lokal), SDK tidak mengirim request apa pun.
 */
import { inject } from '@vercel/analytics'

export default defineNuxtPlugin(() => {
  inject()
})
