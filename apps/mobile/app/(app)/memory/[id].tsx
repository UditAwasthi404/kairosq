import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Legacy "memory" routes alias to observation detail.
 * Kairos stores memories as observations on the backend.
 */
export default function MemoryDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/(app)/observation/${String(id)}`} />;
}
