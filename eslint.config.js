import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import prettier from '@vue/eslint-config-prettier'

export default defineConfigWithVueTs(
  { ignores: ['dist', 'src/api/schema.d.ts'] },
  js.configs.recommended,
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  prettier,
)
