// File: App.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import RNFS from 'react-native-fs';
import { enablePromise, openDatabase, SQLiteDatabase } from 'react-native-sqlite-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

enablePromise(true);

const DB_NAME = 'localdata.db';

// ---- THEME ----
const makeTheme = (isDark: boolean) => {
  const fg = isDark ? '#E6E6E6' : '#111827';
  const sub = isDark ? '#A0A7B4' : '#6B7280';
  const bg = isDark ? '#0B0F14' : '#F5F7FB';
  const card = isDark ? '#151A23' : '#FFFFFF';
  const border = isDark ? '#263041' : '#E5E7EB';
  const muted = isDark ? '#1B2230' : '#F1F3F9';
  const primary = '#4E7AF7';
  const primaryPressed = '#3D68E6';
  const danger = '#EF4444';
  const success = '#22C55E';
  return { isDark, color: { fg, sub, bg, card, border, muted, primary, primaryPressed, danger, success }, r: { sm: 10, md: 14, lg: 20 }, s: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 } };
};

const type = {
  h1: { fontSize: 22, fontWeight: '800' as const },
  h2: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.3 },
};

// ---- DB HELPERS ----
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
function fmt(ts: number) {
  try { return new Date(ts).toLocaleString(); } catch { return ''; }
}

// ---- UI PRIMITIVES ----
const AppBar = ({ theme, username }: any) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.s.lg, paddingTop: theme.s.sm, paddingBottom: theme.s.md }}>
    <View>
      <Text style={[type.h1, { color: theme.color.fg }]}>Storage Playground</Text>
      <Text style={[type.small, { color: theme.color.sub }]}>AsyncStorage • SQLite • Firestore</Text>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.card, borderRadius: 999, borderWidth: 1, borderColor: theme.color.border, paddingVertical: 6, paddingHorizontal: 10 }}>
      <Icon name="account-circle" size={18} color={theme.color.sub} />
      <Text style={[type.small, { color: theme.color.fg, marginLeft: 6 }]} numberOfLines={1}>
        {username || 'Guest'}
      </Text>
    </View>
  </View>
);

const Section = ({ theme, title, subtitle, children }: any) => (
  <View style={[styles.card, { backgroundColor: theme.color.card, borderColor: theme.color.border, borderRadius: theme.r.lg }]}>
    <Text style={[type.h2, { color: theme.color.fg }]}>{title}</Text>
    {subtitle ? <Text style={[type.small, { color: theme.color.sub, marginTop: 2 }]}>{subtitle}</Text> : null}
    <View style={{ height: 10 }} />
    {children}
  </View>
);

const Field = ({ theme, label, value, onChangeText, placeholder }: any) => (
  <View style={{ marginBottom: theme.s.md }}>
    <Text style={[type.label, { color: theme.color.sub, marginBottom: 6 }]}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.isDark ? '#7A8190' : '#9AA3AF'}
      style={[styles.input, { borderColor: theme.color.border, backgroundColor: theme.color.muted, color: theme.color.fg, borderRadius: theme.r.md }]}
    />
  </View>
);

const Button = ({ theme, label, icon, onPress, kind = 'primary' }: any) => {
  const bg = kind === 'primary' ? theme.color.primary : theme.color.muted;
  const fg = kind === 'primary' ? '#fff' : theme.color.fg;
  const bgPressed = kind === 'primary' ? theme.color.primaryPressed : (theme.isDark ? '#20283A' : '#E7EAF4');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: pressed ? bgPressed : bg, borderRadius: theme.r.md, borderWidth: kind === 'primary' ? 0 : 1, borderColor: theme.color.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        {icon ? <Icon name={icon} size={18} color={fg} style={{ marginRight: 8 }} /> : null}
        <Text style={[type.body, { color: fg }]}>{label}</Text>
      </View>
    </Pressable>
  );
};

const Chip = ({ theme, label, active, onPress, icon }: any) => (
  <Pressable onPress={onPress} style={({ pressed }) => ({
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: active ? theme.color.primary : theme.color.muted,
    opacity: pressed ? 0.9 : 1, borderWidth: active ? 0 : 1, borderColor: theme.color.border, marginRight: 8,
    flexDirection: 'row', alignItems: 'center'
  })}>
    {icon ? <Icon name={icon} size={16} color={active ? '#fff' : theme.color.fg} style={{ marginRight: 6 }} /> : null}
    <Text style={[type.small, { color: active ? '#fff' : theme.color.fg }]}>{label}</Text>
  </Pressable>
);

const Toast = ({ theme, text, type: t }: any) => {
  if (!text) return null;
  const bg = t === 'error' ? theme.color.danger : t === 'success' ? theme.color.success : theme.color.primary;
  return (
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24, padding: 12, borderRadius: 12, backgroundColor: bg }}>
      <Text style={[type.body, { color: '#fff', textAlign: 'center' }]}>{text}</Text>
    </View>
  );
};

// ---- MAIN APP ----
export default function App() {
  const isDark = useColorScheme() === 'dark';
  const theme = useMemo(() => makeTheme(isDark), [isDark]);

  // AsyncStorage
  const [username, setUsername] = useState('');
  const [savedUser, setSavedUser] = useState<string | null>(null);

  // SQLite notes
  const [notes, setNotes] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [sortNewest, setSortNewest] = useState(true);

  // modal for add/edit
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  // Firestore
  const [remoteNote, setRemoteNote] = useState('');

  // toast
  const [toast, setToast] = useState<{ text: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (text: string, type?: 'success' | 'error' | 'info') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 1500);
  };

  useEffect(() => {
    (async () => {
      try {
        const u = await AsyncStorage.getItem('username');
        setSavedUser(u);
        await initDb();
        await reloadNotes();
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // ---- DATA ACTIONS ----
  async function reloadNotes() {
    const db = await getDb();
    const res = await db.executeSql('SELECT id, title, created_at FROM notes;');
    const rows = res[0].rows;
    const list: any[] = [];
    for (let i = 0; i < rows.length; i++) list.push(rows.item(i));
    setNotes(list);
  }

  async function saveUsername() {
    if (!username.trim()) return;
    const v = username.trim();
    await AsyncStorage.setItem('username', v);
    setSavedUser(v);
    setUsername('');
    showToast('Username saved', 'success');
  }

  async function createOrUpdateNote() {
    const text = draft.trim();
    if (!text) return;
    const db = await getDb();
    if (editingId == null) {
      await db.executeSql('INSERT INTO notes (title, created_at) VALUES (?, ?);', [text, Date.now()]);
      showToast('Note added', 'success');
    } else {
      await db.executeSql('UPDATE notes SET title = ? WHERE id = ?;', [text, editingId]);
      showToast('Note updated', 'success');
    }
    setDraft('');
    setEditingId(null);
    setModalVisible(false);
    await reloadNotes();
  }

  async function deleteNote(id: number) {
    const db = await getDb();
    await db.executeSql('DELETE FROM notes WHERE id = ?;', [id]);
    showToast('Note deleted', 'success');
    await reloadNotes();
  }

  async function exportNotes() {
    try {
      const path = `${RNFS.DocumentDirectoryPath}/notes_${Date.now()}.json`;
      await RNFS.writeFile(path, JSON.stringify(notes, null, 2), 'utf8');
      Alert.alert('Exported', `Saved at: ${path}`);
    } catch {
      showToast('Export failed', 'error');
    }
  }

  async function addRemote() {
    if (!remoteNote.trim()) return;
    await firestore().collection('notes').add({
      title: remoteNote.trim(),
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    setRemoteNote('');
    showToast('Uploaded to Firestore', 'success');
  }

  // ---- FILTER + SORT ----
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const data = q ? notes.filter(n => String(n.title).toLowerCase().includes(q)) : notes;
    return data.sort((a, b) => (sortNewest ? b.created_at - a.created_at : a.created_at - b.created_at));
  }, [notes, query, sortNewest]);

  // ---- UI ----
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.color.bg} />

      <AppBar theme={theme} username={savedUser} />

      <ScrollView contentContainerStyle={{ padding: theme.s.lg, gap: theme.s.lg }} keyboardShouldPersistTaps="handled">
        {/* Profile quick action */}
        <Section theme={theme} title="Profile" subtitle="Shared Preferences (AsyncStorage)">
          <Field theme={theme} label="Username" value={username} onChangeText={setUsername} placeholder="Type your name" />
          <Button theme={theme} label="Save Username" icon="content-save" onPress={saveUsername} />
          <View style={{ height: 8 }} />
          <Text style={[type.small, { color: theme.color.sub }]}>
            Current: <Text style={{ color: theme.color.fg, fontWeight: '700' }}>{savedUser ?? '—'}</Text>
          </Text>
        </Section>

        {/* Notes */}
        <Section theme={theme} title="Notes" subtitle="SQLite (local database)">
          {/* Search + Sort row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.s.md }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.muted, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border, paddingHorizontal: 10 }}>
              <Icon name="magnify" size={18} color={theme.color.sub} />
              <TextInput
                placeholder="Search notes…"
                placeholderTextColor={theme.isDark ? '#7A8190' : '#9AA3AF'}
                value={query}
                onChangeText={setQuery}
                style={{ flex: 1, color: theme.color.fg, paddingVertical: 8, paddingLeft: 6 }}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')}>
                  <Icon name="close-circle" size={18} color={theme.color.sub} />
                </Pressable>
              ) : null}
            </View>
            <View style={{ width: 10 }} />
            <Chip
              theme={theme}
              label={sortNewest ? 'Newest' : 'Oldest'}
              active={true}
              icon={sortNewest ? 'sort-clock-descending' : 'sort-clock-ascending'}
              onPress={() => setSortNewest(s => !s)}
            />
          </View>

          {/* List */}
          {filtered.length === 0 ? (
            <View style={{ padding: theme.s.md, backgroundColor: theme.color.muted, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border }}>
              <Text style={[type.small, { color: theme.color.sub }]}>No notes yet. Tap the + button to add one.</Text>
            </View>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item }) => (
                <View style={{ padding: 12, backgroundColor: theme.color.card, borderWidth: 1, borderColor: theme.color.border, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { color: theme.color.fg }]} numberOfLines={2}>{item.title}</Text>
                    <Text style={[type.small, { color: theme.color.sub, marginTop: 4 }]}>{fmt(item.created_at)}</Text>
                  </View>
                  <Pressable
                    onPress={() => { setEditingId(item.id); setDraft(item.title); setModalVisible(true); }}
                    style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.7 : 1 })}
                    accessibilityLabel="Edit"
                  >
                    <Icon name="pencil" size={20} color={theme.color.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => Alert.alert('Delete note?', 'This cannot be undone.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteNote(item.id) },
                    ])}
                    style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.7 : 1 })}
                    accessibilityLabel="Delete"
                  >
                    <Icon name="trash-can" size={20} color={theme.color.danger} />
                  </Pressable>
                </View>
              )}
            />
          )}

          <View style={{ height: 10 }} />
          <Button theme={theme} kind="secondary" label="Export Notes (JSON)" icon="tray-arrow-down" onPress={exportNotes} />
        </Section>

        {/* Firestore */}
        <Section theme={theme} title="Cloud" subtitle="Firebase Firestore">
          <Field theme={theme} label="Remote note" value={remoteNote} onChangeText={setRemoteNote} placeholder="Send to the cloud…" />
          <Button theme={theme} label="Add Remote Note" icon="cloud-upload" onPress={addRemote} />
          <Text style={[type.small, { color: theme.color.sub, marginTop: 8 }]}>Check Firebase Console → Firestore to see new docs.</Text>
        </Section>

        <View style={{ height: theme.s.xl }} />
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        onPress={() => { setEditingId(null); setDraft(''); setModalVisible(true); }}
        style={({ pressed }) => ({
          position: 'absolute', right: 20, bottom: 28,
          height: 56, width: 56, borderRadius: 28,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: pressed ? theme.color.primaryPressed : theme.color.primary,
          elevation: 4,
        })}
        accessibilityLabel="Add note"
      >
        <Icon name="plus" size={26} color="#fff" />
      </Pressable>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.color.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: theme.color.border, padding: 16 }}>
            <View style={{ alignItems: 'center', paddingBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: theme.color.border }} />
            </View>
            <Text style={[type.h2, { color: theme.color.fg }]}>{editingId == null ? 'New Note' : 'Edit Note'}</Text>
            <View style={{ height: 8 }} />
            <TextInput
              placeholder="Note title"
              placeholderTextColor={theme.isDark ? '#7A8190' : '#9AA3AF'}
              value={draft}
              onChangeText={setDraft}
              autoFocus
              style={[styles.input, { borderColor: theme.color.border, backgroundColor: theme.color.muted, color: theme.color.fg, borderRadius: 12 }]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Button theme={theme} kind="secondary" label="Cancel" icon="close" onPress={() => { setModalVisible(false); setEditingId(null); }} />
              </View>
              <View style={{ flex: 1 }}>
                <Button theme={theme} label={editingId == null ? 'Add' : 'Save'} icon="check" onPress={createOrUpdateNote} />
              </View>
            </View>
            <View style={{ height: Platform.OS === 'ios' ? 24 : 6 }} />
          </View>
        </View>
      </Modal>

      {/* Toast */}
      <Toast theme={theme} text={toast?.text} type={toast?.type} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderWidth: 1,
    shadowOpacity: Platform.OS === 'android' ? 0.2 : 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
});