import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { AppState, Platform, type AppStateStatus } from 'react-native'

let isRuntimeConfigured = false

/** Installs TanStack Query's React Native lifecycle adapters exactly once. */
export function configureQueryRuntime(): void {
  if (isRuntimeConfigured) {
    return
  }

  isRuntimeConfigured = true

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected))
    }),
  )

  if (Platform.OS === 'web') {
    return
  }

  focusManager.setEventListener((setFocused) => {
    const updateFocus = (status: AppStateStatus) => {
      setFocused(status === 'active')
    }

    updateFocus(AppState.currentState)
    const subscription = AppState.addEventListener('change', updateFocus)

    return () => subscription.remove()
  })
}
