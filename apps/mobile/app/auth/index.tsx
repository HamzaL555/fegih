import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

export default function AuthIndex() {
  const status = useAuthStore((state) => state.status);
  const shouldShowWelcome = useAuthStore((state) => state.shouldShowWelcome);

  if (status === 'authenticated') {
    if (shouldShowWelcome) {
      return <Redirect href={"/auth/welcome" as never} />;
    }
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href="/auth/login" />;
}
