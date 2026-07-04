# Recomendações — Push Notifications CoachPilot

> **Status (jul/2026):** checklist parcialmente implementado. Já existem no código o fluxo
> separado `requestPermissionAndSubscribe`/`ensureSubscriptionIfGranted` (item 7) e os dois
> manifests separados portal/aluno (item 6). **Pendentes confirmados:** timeouts no hook (item 3)
> e o tratamento iOS `isIos && !isStandalone` (item 5) — não encontrados em
> `frontend/src/hooks/usePushNotification.ts`. Verificar itens 1, 2 e 4 antes de fechar o doc.

## Ajustes obrigatórios

1. **Rotacionar as chaves VAPID**

   * A `VAPID_PRIVATE_KEY` foi exposta no plano.
   * Gerar novo par de chaves e atualizar backend/SAM/CloudFormation.
   * Nunca salvar private key em prompt, documento, frontend, repositório ou log.

2. **Validar VAPID no backend**

   * Confirmar que `GET /v1/aluno/push/vapid-key` retorna uma public key válida.
   * Se vier vazio, o push não vai funcionar.
   * Adicionar logs no backend quando a chave estiver ausente.

3. **Adicionar timeout no frontend**

   * Aplicar timeout em:

     * `pushApi.getVapidKey()`
     * `navigator.serviceWorker.ready`
   * Evitar que o botão fique preso em `Ativando…`.

4. **Não engolir erro no hook**

   * Remover `catch` silencioso.
   * Relançar o erro para o caller exibir toast/mensagem.

5. **Corrigir fluxo do iOS**

   * Usar:

   ```ts
   isIos && !isStandalone
   ```

   * Não depender de `pushSupported` para mostrar a orientação de instalação.
   * Em Safari iOS fora do PWA instalado, orientar:

     > Compartilhar → Adicionar à Tela de Início

6. **Evitar dois manifests**

   * Não confiar que o primeiro `<link rel="manifest">` sempre prevalece.
   * O ideal é:

     * Portal: `/manifest.webmanifest`
     * App do aluno: `/aluno.webmanifest`
   * Garantir que o manifest do portal não seja injetado no app do aluno.

7. **Remover auto-subscribe agressivo**

   * Evitar chamar `requestPermission()` automaticamente em `useEffect`.
   * Ativação deve acontecer por clique do usuário.
   * Criar fluxo separado:

   ```ts
   requestPermissionAndSubscribe()
   ensureSubscriptionIfGranted()
   ```

## Ordem recomendada

1. Rotacionar VAPID keys.
2. Validar endpoint `/v1/aluno/push/vapid-key`.
3. Adicionar logs no backend.
4. Adicionar timeouts no hook.
5. Remover erros silenciosos.
6. Corrigir UX do iOS standalone.
7. Corrigir manifest do app do aluno.
8. Testar Android.
9. Testar iOS instalado na tela inicial.
10. Testar envio real via API/backend.
