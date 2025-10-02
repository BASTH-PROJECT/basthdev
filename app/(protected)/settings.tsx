import Container from '@/components/Container';
import { getEditPermissionDescription } from '@/constants/editPermissions';
import { useUser } from '@/contexts/UserContext';
import { DatabaseService } from '@/services/database';
import { colors } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function Settings() {
  const { user } = useUser();
  const router = useRouter();
  const [isResetting, setIsResetting] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);

  // Load auto-sync preference
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;
      
      try {
        const autoSyncPref = await DatabaseService.getInstance().getUserPreference(user.id, 'auto_sync');
        setAutoSync(autoSyncPref === 'true');
      } catch (error) {
        console.error('[SETTINGS] Error loading preferences:', error);
      } finally {
        setIsLoadingPrefs(false);
      }
    };

    loadPreferences();
  }, [user]);

  // Handle auto-sync toggle
  const handleAutoSyncToggle = async (value: boolean) => {
    if (!user) return;
    
    try {
      await DatabaseService.getInstance().setUserPreference(user.id, 'auto_sync', value ? 'true' : 'false');
      setAutoSync(value);
      console.log('[SETTINGS] Auto-sync set to:', value);
    } catch (error) {
      console.error('[SETTINGS] Error saving auto-sync preference:', error);
      Alert.alert('Error', 'Gagal menyimpan pengaturan');
    }
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset Data',
      'Apakah Anda yakin ingin menghapus semua data lokal? Tindakan ini tidak dapat dibatalkan.',
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            
            setIsResetting(true);
            try {
              console.log('[SETTINGS] Resetting local database for user:', user.id);
              
              // Close the database
              await DatabaseService.getInstance().closeDatabase();
              
              // Delete all books and transactions
              const db = await DatabaseService.getInstance().openUserDB(user.id);
              await db.execAsync('DELETE FROM transactions');
              await db.execAsync('DELETE FROM books');
              await db.execAsync('DELETE FROM user_preferences');
              
              console.log('[SETTINGS] Local database reset successfully');
              
              Alert.alert(
                'Berhasil',
                'Data lokal telah dihapus. Silakan restart aplikasi.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate back to home
                      router.replace('/(protected)');
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('[SETTINGS] Error resetting database:', error);
              Alert.alert('Error', 'Gagal menghapus data lokal');
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

  const showEditPermissionInfo = () => {
    const permission = getEditPermissionDescription();
    Alert.alert(
      'Pengaturan Edit Transaksi',
      `Saat ini: ${permission}\n\nUntuk mengubah pengaturan ini, edit file:\nconstants/editPermissions.ts\n\nPilihan yang tersedia:\n• TODAY - Hanya hari ini\n• YESTERDAY - Hanya kemarin\n• TODAY_AND_YESTERDAY - Hari ini dan kemarin`,
      [{ text: 'Mengerti', style: 'default' }]
    );
  };

  return (
    <Container scroll={false}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="settings" size={28} color={colors.brand} />
          </View>
          <Text style={styles.title}>Pengaturan</Text>
          <Text style={styles.subtitle}>Kelola preferensi aplikasi Anda</Text>
        </View>

        {/* Sync Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sync-outline" size={20} color={colors.brand} />
            <Text style={styles.sectionTitle}>Sinkronisasi</Text>
          </View>
          
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconWrap}>
                  <Ionicons name="cloud-upload-outline" size={20} color={colors.brand} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Otomatis Sync</Text>
                  <Text style={styles.settingDescription}>
                    Sinkronkan data secara otomatis setiap kali ada perubahan
                  </Text>
                </View>
              </View>
              <Switch
                value={autoSync}
                onValueChange={handleAutoSyncToggle}
                disabled={isLoadingPrefs}
                trackColor={{ false: colors.border, true: colors.brand }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.border}
              />
            </View>
          </View>
        </View>

        {/* Edit Permission Section */}
        {/* <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create-outline" size={20} color={colors.brand} />
            <Text style={styles.sectionTitle}>Edit Transaksi</Text>
          </View>
          
          <TouchableOpacity style={styles.card} onPress={showEditPermissionInfo} activeOpacity={0.7}>
            <View style={styles.infoRow}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconWrap}>
                  <Ionicons name="time-outline" size={20} color={colors.income} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Izin Edit</Text>
                  <Text style={styles.settingDescription}>
                    {getEditPermissionDescription()}
                  </Text>
                </View>
              </View>
              <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View> */}

        {/* Account Section */}
        {/* <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color={colors.brand} />
            <Text style={styles.sectionTitle}>Akun</Text>
          </View>
          
          <View style={styles.card}>
            <View style={styles.accountInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={styles.accountDetails}>
                <Text style={styles.accountName}>{user?.name || 'User'}</Text>
                <Text style={styles.accountEmail}>{user?.email || 'email@example.com'}</Text>
              </View>
            </View>
          </View>
        </View> */}

        {/* Data Management Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="server-outline" size={20} color={colors.danger} />
            <Text style={styles.sectionTitle}>Manajemen Data</Text>
          </View>
          
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={handleResetData}
              disabled={isResetting}
              activeOpacity={0.8}
            >
              <View style={styles.dangerButtonContent}>
                <Ionicons name="trash-outline" size={22} color={colors.white} />
                <View style={styles.dangerButtonTextWrap}>
                  <Text style={styles.dangerButtonTitle}>
                    {isResetting ? 'Menghapus...' : 'Reset Data Lokal'}
                  </Text>
                  <Text style={styles.dangerButtonSubtitle}>
                    Hapus semua buku dan transaksi
                  </Text>
                </View>
              </View>
              {isResetting && (
                <ActivityIndicator size="small" color={colors.white} />
              )}
            </TouchableOpacity>
            
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={18} color={colors.danger} />
              <Text style={styles.warningText}>
                Tindakan ini tidak dapat dibatalkan. Data yang sudah disinkronkan ke cloud tidak akan terhapus.
              </Text>
            </View>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>ONI CashApp v1.0.0</Text>
          <Text style={styles.footerSubtext}>Kelola keuangan Anda dengan mudah</Text>
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    // paddingHorizontal: 20,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
    // paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  settingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  accountEmail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.danger,
    padding: 16,
    margin: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  dangerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dangerButtonTextWrap: {
    flex: 1,
  },
  dangerButtonTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  dangerButtonSubtitle: {
    color: colors.white,
    fontSize: 13,
    opacity: 0.9,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    paddingTop: 0,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    opacity: 0.7,
  },
});
