import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// 开发默认同源 proxy（后端已开 CORS，直连也可以；见 README）
const backend = 'http://127.0.0.1:8000'
const proxied = ['/auth', '/chat', '/memories', '/microservices', '/kb', '/health']

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    AutoImport({ resolvers: [ElementPlusResolver()] }),
    Components({ resolvers: [ElementPlusResolver()] }),
  ],
  server: {
    proxy: Object.fromEntries(proxied.map((p) => [p, { target: backend, changeOrigin: true }])),
  },
})
