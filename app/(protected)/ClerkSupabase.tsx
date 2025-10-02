import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Button, FlatList, StyleSheet, Text, TextInput, View } from "react-native";

// --- Database schema ---
export type Database = {
  public: {
    Tables: {
      test_table: {
        Row: {
          id: number;
          message: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          message?: string | null;
          created_at?: string;
        };
        Update: {
          message?: string | null;
          created_at?: string;
        };
      };
    };
  };
};

// --- Supabase client ---
const supabaseUrl = "https://enztgtaljsyxdjjuaqtm.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuenRndGFsanN5eGRqanVhcXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwODQxOTIsImV4cCI6MjA3NDY2MDE5Mn0.EVnhlotOzJCWgcqEi0is5U2ppfvjwFi6_OYv8E-6Cts";

// Debug logging
console.log('Using hardcoded Supabase configuration:', {
  supabaseUrl: supabaseUrl ? 'Set (length: ' + supabaseUrl.length + ')' : 'Missing',
  supabaseAnonKey: supabaseAnonKey ? 'Set (length: ' + supabaseAnonKey.length + ')' : 'Missing',
  supabaseUrlStartsWithHttp: supabaseUrl?.startsWith('http') || false,
  supabaseUrlStartsWithHttps: supabaseUrl?.startsWith('https') || false,
});

const supabase = supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;

console.log('Supabase client initialized:', supabase ? 'Yes' : 'No');

type TestTableRow = Database["public"]["Tables"]["test_table"]["Row"];

// --- Component ---
export default function ClerkSupabase() {
  const [rows, setRows] = useState<TestTableRow[]>([]);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // fetch rows
  const fetchData = async () => {
    if (!supabase) {
      setStatus({ type: "error", text: "Supabase client not initialized" });
      return;
    }

    const { data, error } = await supabase
      .from("test_table")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      setStatus({ type: "error", text: error.message });
    } else {
      setRows(data ?? []);
    }
  };

  // add or update
  const saveRow = async () => {
    if (!supabase) {
      setStatus({ type: "error", text: "Supabase client not initialized" });
      return;
    }

    if (!message.trim()) {
      setStatus({ type: "error", text: "Message cannot be empty" });
      return;
    }

    setLoading(true);
    let error;
    if (editingId) {
      ({ error } = await (supabase as any)
        .from("test_table")
        .update({ message })
        .eq("id", editingId));
    } else {
      ({ error } = await supabase
        .from("test_table")
        .insert([{ message }] as any));
    }
    setLoading(false);

    if (error) {
      setStatus({ type: "error", text: error.message });
    } else {
      setMessage("");
      setEditingId(null);
      fetchData();
      setStatus({
        type: "success",
        text: editingId ? "Message updated successfully" : "Message added successfully",
      });
    }
  };

  // delete row
  const deleteRow = async (id: number) => {
    if (!supabase) {
      setStatus({ type: "error", text: "Supabase client not initialized" });
      return;
    }

    const { error } = await supabase.from("test_table").delete().eq("id", id);
    if (error) {
      setStatus({ type: "error", text: error.message });
    } else {
      fetchData();
      setStatus({ type: "success", text: "Message deleted" });
    }
  };

  // check environment
  const checkEnvironment = () => {
    const envStatus = {
      configuration: 'Hardcoded values',
      url: supabaseUrl ? 'Set' : 'Missing',
      key: supabaseAnonKey ? 'Set' : 'Missing',
      urlValid: supabaseUrl?.startsWith('http') ? 'Valid' : 'Invalid',
      clientInitialized: supabase ? 'Yes' : 'No',
    };

    console.log('Configuration check:', envStatus);

    let statusMessage = `Configuration: ${envStatus.configuration}`;
    statusMessage += `\nURL: ${envStatus.url} (${envStatus.urlValid})`;
    statusMessage += `\nKey: ${envStatus.key ? 'Set' : 'Missing'}`;
    statusMessage += `\nClient: ${envStatus.clientInitialized}`;

    setStatus({
      type: "error",
      text: statusMessage
    });

    return envStatus;
  };

  // test connection
  const testConnection = async () => {
    if (!supabase) {
      setStatus({ type: "error", text: "Supabase client not initialized" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("test_table")
        .select("count")
        .limit(1);

      if (error) {
        setStatus({ type: "error", text: `Connection test failed: ${error.message}` });
      } else {
        setStatus({ type: "success", text: "Connection test successful!" });
      }
    } catch (err) {
      setStatus({ type: "error", text: `Connection test error: ${err}` });
    }
    setLoading(false);
  };

  // edit row
  const startEdit = (row: TestTableRow) => {
    setMessage(row.message ?? "");
    setEditingId(row.id);
  };

  useEffect(() => {
    console.log('Component mounted - checking supabase:', supabase ? 'Available' : 'Not available');

    if (!supabase) {
      setStatus({ type: "error", text: "Supabase client initialization failed. Check console for details." });
    } else {
      fetchData();
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test Table</Text>

      {status && (
        <View
          style={[
            styles.status,
            status.type === "success" ? styles.success : styles.error,
          ]}
        >
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Enter message"
        value={message}
        onChangeText={setMessage}
      />

      <Button
        title={loading ? "Saving..." : editingId ? "Update Message" : "Add Message"}
        onPress={saveRow}
        disabled={loading}
      />

      <Button
        title="Test Connection"
        onPress={testConnection}
        disabled={loading}
      />

      <Button
        title="Check Configuration"
        onPress={checkEnvironment}
        disabled={loading}
      />

      <FlatList
        style={{ marginTop: 20 }}
        data={rows}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>{item.message}</Text>
            <View style={styles.rowButtons}>
              <Button title="Edit" onPress={() => startEdit(item)} />
              <Button title="Delete" onPress={() => deleteRow(item.id)} color="red" />
            </View>
          </View>
        )}
      />
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  row: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowButtons: { flexDirection: "row", marginTop: 6, gap: 10 },
  status: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  success: { backgroundColor: "#d4edda" },
  error: { backgroundColor: "#f8d7da" },
  statusText: {
    fontSize: 14,
    color: "#000",
  },
});
