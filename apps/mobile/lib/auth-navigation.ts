import { Router } from 'expo-router';

export function navigateToApp(router: Router): void {
  router.replace('/(app)');
}

export function navigateToSignIn(router: Router) {
  router.replace('/(auth)/sign-in');
}
