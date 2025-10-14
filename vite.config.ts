import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages で /<repo>/ または /<repo>/v1/ のように
// サブパスへデプロイするため、環境変数から base を注入します。
// Actions 側で BASE_PATH を設定（例: /tennis-pairing/, /tennis-pairing/v1/）
const base = process.env.BASE_PATH || '/tennis-pairing/';

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    outDir: 'dist',
  },
});
