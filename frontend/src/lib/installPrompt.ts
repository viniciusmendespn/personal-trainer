type InstallPromptEvent = Event & { prompt: () => Promise<void> }

let _deferred: InstallPromptEvent | null = null

// Captura e suprime o prompt do Chrome imediatamente — antes do React montar.
// Assim o browser não exibe o banner nativo na landing page.
// O AppLayout chama getInstallPrompt() depois do login para acionar sob demanda.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  _deferred = e as InstallPromptEvent
})

export function getInstallPrompt() { return _deferred }
export function clearInstallPrompt() { _deferred = null }
