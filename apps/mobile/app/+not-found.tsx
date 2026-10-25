import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <AppScreen>
      <AppText variant="title">{t('errors.notFound')}</AppText>
      <Button label={t('common.back')} onPress={() => undefined} style={{ marginTop: 20 }} />
      <Link href="/" style={{ marginTop: 16 }}>
        <AppText>{t('common.appName')}</AppText>
      </Link>
    </AppScreen>
  );
}
