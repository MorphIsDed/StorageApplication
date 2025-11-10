// File: App.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  SafeAreaView,
  StatusBar,
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import RNFS from 'react-native-fs';
/* react-native-sqlite-storage does not ship TypeScript types; require it as any to avoid TS errors */
const sqlite: any = require('react-native-sqlite-storage');
const { enablePromise, openDatabase } = sqlite;
type SQLiteDatabase = any;

enablePromise(true);

const DB_NAME = 'localdata.db';

// THEME
const makeTheme = (isDark: boolean) => {
  const fg = isDark ? '#E6E6E6' : '#121212';
  const sub = isDark ? '#B8B8B8' : '#5F6773';
  const bg = isDark ? '#0C0E12' : '#F6F7FB';
  const card = isDark ? '#151922' : '#FFFFFF';
  const border = isDark ? '#2A2F3A' : '#E6E8EF';
  const primary = '#4E7AF7';
  const primaryPressed = '#3D68E6';
  const muted = isDark ? '#202632' : '#F0F2F7';

  return {
    isDark,
    color: { fg, sub, bg, card, border, primary, primaryPressed, muted },
    radius: { sm: 10, md: 14, lg: 20 },
    space: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
  };
};

const typography = {
  h1: { fontSize: 22, fontWeight: '800' as const },
  h2: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
};

// DB
async function getDb(): Promise<SQLiteDatabase> {
  return openDatabase({ name: DB_NAME, location: 'default' });
}

async function initDb() {
  const db = await getDb();
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString();
}

// UI COMPONENTS
const Section = ({ theme, title, subtitle, children }: any) => (
  <View
    style={[
      styles.card,
      {
        backgroundColor: theme.color.card,
        borderColor: theme.color.border,
        borderRadius: theme.radius.lg,
      },
    ]}
  >
    <Text style={[typography.h2, { color: theme.color.fg, marginBottom: 4 }]}>{title}</Text>
    {subtitle && (
      <Text style={[typography.small, { color: theme.color.sub, marginBottom: theme.space.sm }]}>
        {subtitle}
      </Text>
    )}
    {children}
  </View>
);

const LabeledInput = ({
  theme,
  label,
  value,
  onChangeText,
  placeholder,
}: any) => (
  <View style={{ marginBottom: theme.space.md }}>
    <Text style={[typography.label, { color: theme.color.sub, marginBottom: 6 }]}>{label}</Text>
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={theme.isDark ? '#7A8190' : '#9AA3AF'}
      value={value}
      onChangeText={onChangeText}
      style={[
        styles.input,
        {
          color: theme.color.fg,
          backgroundColor: theme.color.muted,
          borderColor: theme.color.border,
          borderRadius: theme.radius.md,
        },
      ]}
    />
  </View>
);

const Button = ({ label, onPress, theme, kind = 'primary' }: any) => {
  const bg = kind === 'primary' ? theme.color.primary : theme.color.muted;
  const bgPressed = kind === 'primary' ? theme.color.primaryPressed : theme.color.border;
  const fg = kind === 'primary' ? '#FFFFFF' : theme.color.fg;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? bgPressed : bg,
          borderRadius: theme.radius.md,
        },
      ]}
    >
      <Text style={[typography.body, { color: fg, textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );
};

// MAIN APP
export default function App() {
  const isDark = useColorScheme() === 'dark';
  const theme = useMemo(() => makeTheme(isDark), [isDark]);

  const [username, setUsername] = useState('');
  const [savedUser, setSavedUser] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState<any[]>([]);

  const [remoteNote, setRemoteNote] = useState('');

  useEffect(() => {
    (async () => {
      const user = await AsyncStorage.getItem('username');
      setSavedUser(user);

      await initDb();
      await loadNotes();
    })();
  }, []);

  // ACTIONS
  const saveUsername = async () => {
    if (!username.trim()) return;
    await AsyncStorage.setItem('username', username.trim());
    setSavedUser(username.trim());
    setUsername('');
    Alert.alert('Saved', 'Username stored.');
  };

  const addNote = async () => {
    if (!title.trim()) return;
    const db = await getDb();
    await db.executeSql('INSERT INTO notes (title, created_at) VALUES (?, ?);', [
      title.trim(),
      Date.now(),
    ]);
    setTitle('');
    await loadNotes();
  };

  const loadNotes = async () => {
    const db = await getDb();
    const result = await db.executeSql(
      'SELECT id, title, created_at FROM notes ORDER BY created_at DESC;',
    );
    const list = [];
    const rows = result[0].rows;
    for (let i = 0; i < rows.length; i++) list.push(rows.item(i));
    setNotes(list);
  };

  const exportNotes = async () => {
    const path = `${RNFS.DocumentDirectoryPath}/notes_${Date.now()}.json`;
    await RNFS.writeFile(path, JSON.stringify(notes, null, 2), 'utf8');
    Alert.alert('Exported', `Saved at: ${path}`);
  };

  const addRemote = async () => {
    if (!remoteNote.trim()) return;
    await firestore().collection('notes').add({
      title: remoteNote.trim(),
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    setRemoteNote('');
    Alert.alert('Firestore', 'Saved to cloud.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[typography.h1, { color: theme.color.fg }]}>Storage Playground</Text>
        <Text style={[typography.small, { color: theme.color.sub }]}>
          AsyncStorage · SQLite · Firebase
        </Text>

        {/* AsyncStorage */}
        <Section title="Shared Preferences (AsyncStorage)" theme={theme}>
          <Text style={[typography.body, { color: theme.color.sub, marginBottom: 10 }]}>
            Saved username: <Text style={{ color: theme.color.fg }}>{savedUser ?? '—'}</Text>
          </Text>
          <LabeledInput
            theme={theme}
            label="Username"
            placeholder="Type your name"
            value={username}
            onChangeText={setUsername}
          />
          <Button label="Save Username" theme={theme} onPress={saveUsername} />
        </Section>

        {/* SQLite */}
        <Section title="Local DB (SQLite)" theme={theme}>
          <LabeledInput
            theme={theme}
            label="Note title"
            placeholder="Write something..."
            value={title}
            onChangeText={setTitle}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button label="Add Note" theme={theme} onPress={addNote} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Export JSON" theme={theme} kind="secondary" onPress={exportNotes} />
            </View>
          </View>

          {notes.length === 0 ? (
            <Text style={[typography.small, { color: theme.color.sub, marginTop: 10 }]}>
              No notes yet.
            </Text>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={notes}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <View
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: theme.color.muted,
                  }}
                >
                  <Text style={{ color: theme.color.fg }}>{item.title}</Text>
                  <Text style={{ color: theme.color.sub, fontSize: 12 }}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              )}
            />
          )}
        </Section>

        {/* Firestore */}
        <Section title="Firebase Firestore (Cloud)" theme={theme}>
          <LabeledInput
            theme={theme}
            label="Remote note"
            placeholder="Send to the cloud..."
            value={remoteNote}
            onChangeText={setRemoteNote}
          />
          <Button label="Add Remote Note" theme={theme} onPress={addRemote} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderWidth: 1,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    paddingVertical: 12,
    borderWidth: 1,
  },
});
