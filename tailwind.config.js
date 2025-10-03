// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // 念のため
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  safelist: [
    // 屋外/屋内ボタンの強調
    'bg-amber-400','border-amber-500','hover:bg-amber-500','text-black',
    // 参加者・操作ボタンのベース
    'bg-white','text-black','border-neutral-300','border-neutral-400','shadow-sm','hover:bg-neutral-100',
    // 消去ボタンの警告色
    'bg-red-600','hover:bg-red-700','text-white',
    // 選択ボタン色
    'bg-sky-600','border-sky-700',
    // 履歴のハイライト
    'bg-blue-50','border-blue-500','text-blue-900','text-blue-800','text-blue-700',
    // 離脱
    'bg-yellow-400','border-yellow-500',
  ],
}
