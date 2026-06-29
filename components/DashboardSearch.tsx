import { Pressable, Text, TextInput, View } from 'react-native';

type Props = {
  query: string;
  onChange: (next: string) => void;
  matchCount: number | null;
};

export function DashboardSearch({ query, onChange, matchCount }: Props) {
  return (
    <View className="mb-4">
      <View className="relative">
        <TextInput
          value={query}
          onChangeText={onChange}
          placeholder="Search by name, company, or title"
          placeholderTextColor="#78716c"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-xl border border-otto-border bg-otto-card px-4 py-3 pr-20 text-otto-text"
          style={{ fontSize: 17 }}
        />
        {query ? (
          <View className="absolute inset-y-0 right-2 flex-row items-center gap-2">
            {matchCount !== null && (
              <Text className="text-xs text-otto-muted">
                {matchCount} {matchCount === 1 ? 'match' : 'matches'}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => onChange('')}
              className="rounded-md px-2 py-0.5">
              <Text className="text-base text-otto-muted">×</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
