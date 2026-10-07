import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '../../../components/ThemedText';
import { GlassPanel } from '../../../components/ui/Glass';
import { PressScale } from '../../../components/ui/Motion';

const EXAMPLES = ['Side project', 'Reading notes', 'Trip planning', 'Health', 'Work ideas'];
import { SoftPage } from '../../../components/ui/SoftScreen';
import { ThemedButton } from '../../../components/ui/ThemedButton';
import { ThemedInput } from '../../../components/ui/ThemedInput';
import { ApiError, createProject } from '../../../lib/api';
import { useAppTheme } from '../../../providers/ThemeProvider';

export default function NewProjectScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { getToken } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('You must be signed in.', 401);
      const project = await createProject({
        token,
        name: trimmed,
        description: description.trim() || null,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/(app)/projects/${project.id}`);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SoftPage>
      <ThemedText colorKey="textMuted" style={styles.lead}>
        A project keeps related memories together so you can ask about all of them at once.
      </ThemedText>
      <GlassPanel contentStyle={styles.form}>
        <ThemedInput
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (error) setError(null);
          }}
          placeholder="Name"
          accessibilityLabel="Project name"
          maxLength={120}
        />
        <ThemedInput
          value={description}
          onChangeText={setDescription}
          placeholder="Note (optional)"
          accessibilityLabel="Project description"
          multiline
          style={styles.noteInput}
          maxLength={2000}
        />
      </GlassPanel>

      {name.trim().length === 0 ? (
        <View style={styles.examples}>
          {EXAMPLES.map((example) => (
            <PressScale
              key={example}
              onPress={() => {
                void Haptics.selectionAsync();
                setName(example);
              }}
              accessibilityLabel={`Use ${example}`}
            >
              <View style={[styles.example, { borderColor: colors.border }]}>
                <ThemedText colorKey="textSecondary" style={styles.exampleText}>
                  {example}
                </ThemedText>
              </View>
            </PressScale>
          ))}
        </View>
      ) : null}

      {error ? (
        <ThemedText colorKey="error" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      <ThemedButton
        label={saving ? 'Creating…' : 'Create project'}
        disabled={saving || name.trim().length === 0}
        onPress={() => {
          void save().catch((err) => {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
          });
        }}
      />
    </SoftPage>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: 'Roboto_400Regular', fontSize: 14, lineHeight: 20 },
  form: { gap: 12 },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  example: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  exampleText: { fontFamily: 'Roboto_500Medium', fontSize: 13 },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  error: { fontFamily: 'Roboto_400Regular', fontSize: 13 },
});
