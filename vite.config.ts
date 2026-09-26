import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  base: '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api': {
        // 保留 /api 前缀，与 server 的 app.use('/api/...') 一致
        // 旧 rewrite 去掉首个 / 会导致代理异常（表现为 500）
        target: 'http://localhost:4158',
        changeOrigin: true,
      },
      // 管理员新上传的宠物图走后端静态目录，避免仅依赖 Vite public 缓存
      '/pets': {
        target: 'http://localhost:4158',
        changeOrigin: true,
      },
      '/downloads': {
        target: 'http://localhost:4158',
        changeOrigin: true,
      },
    },
    // 静态资源缓存配置
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  },
  // 构建配置 - 静态资源添加 hash（保留 dist/pets，避免清空百兆图鉴）
  build: {
    emptyOutDir: false,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name)) {
            return `assets/images/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        }
      }
    }
  }
})