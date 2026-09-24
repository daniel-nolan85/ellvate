import { router, type Href } from 'expo-router';

import { DirectoryScreen } from '@/src/modules/directory';

export default function DirectoryTab() {
  return (
    <DirectoryScreen
      onOpenBusiness={(id) => router.push(`/business/${id}` as Href)}
      onOpenService={(id) => router.push(`/service/${id}` as Href)}
    />
  );
}
