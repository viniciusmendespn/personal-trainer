/**
 * Link direto do app do CoachPilot no diretório do ChatGPT.
 * Abre a tela de instalação do app (para quem já está logado no ChatGPT).
 *
 * ⚠️ O mesmo endereço aparece literal nos arquivos de conteúdo, que são dados puros
 * sem import — se o app for republicado com outro id, atualizar também:
 *   frontend/src/pages/landing/blogData.js
 *   frontend/src/pages/landing/publicSeoData.js
 *   frontend/public/llms.txt
 *   frontend/public/ajuda-portal.md
 * `grep -r plugin_asdk_app_ frontend` acha todos de uma vez.
 */
export const CHATGPT_APP_URL =
  'https://chatgpt.com/plugins/plugin_asdk_app_6a80cc8edfb48191b895cbaecd19b642'
