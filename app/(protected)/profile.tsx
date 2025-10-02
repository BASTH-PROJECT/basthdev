import Container from '@/components/Container';
import { useUser } from '@/contexts/UserContext';
import { colors } from '@/styles/colors';
import { useUser as useClerkUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ProfileScreen() {
  const { user: contextUser, updateUserName } = useUser();
  const { user: clerkUser } = useClerkUser();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(contextUser?.name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Check if user signed up with email (can edit) or Google (read-only)
  const isEmailUser = clerkUser?.externalAccounts?.length === 0;
  const isGoogleUser = clerkUser?.externalAccounts?.some(
    (account) => account.provider === 'google'
  );

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      Alert.alert('Error', 'Nama tidak boleh kosong');
      return;
    }

    setIsLoading(true);
    try {
      // Update Clerk user's firstName
      if (clerkUser) {
        console.log('[PROFILE] Updating Clerk user firstName:', editedName.trim());
        await clerkUser.update({
          firstName: editedName.trim(),
        });
        console.log('[PROFILE] Clerk user firstName updated successfully');
      }

      // Also update local context
      await updateUserName(editedName.trim());

      setIsEditing(false);
      Alert.alert('Berhasil', 'Nama berhasil diperbarui!');
    } catch (error: any) {
      console.error('Error updating name:', error);
      Alert.alert('Error', error.message || 'Gagal memperbarui nama. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(contextUser?.name || '');
    setIsEditing(false);
  };

  const handleImageUpload = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Izin Diperlukan', 'Berikan izin untuk mengakses foto Anda.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        // Updated: MediaTypeOptions is deprecated. Use array of media types.
        // Using string literal keeps compatibility with current type defs.
        mediaTypes: ['images'] as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      setIsUploadingImage(true);

      // Get the image URI
      const imageUri = result.assets[0].uri;
      console.log('[PROFILE] Selected image:', imageUri);

      // Convert image to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        try {
          const base64data = reader.result as string;
          
          // Update Clerk user with new profile image
          if (clerkUser) {
            console.log('[PROFILE] Uploading image to Clerk...');
            await clerkUser.setProfileImage({
              file: base64data,
            });
            console.log('[PROFILE] Profile image updated successfully');
            Alert.alert('Berhasil', 'Foto profil berhasil diperbarui!');
          }
        } catch (uploadError: any) {
          console.error('[PROFILE] Error uploading image:', uploadError);
          Alert.alert('Error', uploadError.message || 'Gagal mengunggah gambar. Silakan coba lagi.');
        } finally {
          setIsUploadingImage(false);
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error: any) {
      console.error('[PROFILE] Error selecting image:', error);
      Alert.alert('Error', 'Gagal memilih gambar. Silakan coba lagi.');
      setIsUploadingImage(false);
    }
  };

  return (
    <Container>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profil</Text>
            <Text style={styles.headerSubtitle}>Kelola informasi akun Anda</Text>
          </View>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <Image
                source={{
                  uri: clerkUser?.imageUrl || 'https://via.placeholder.com/100',
                }}
                style={styles.avatar}
                defaultSource={{ uri: 'https://via.placeholder.com/100' }}
              />
              {isGoogleUser && (
                <View style={styles.googleBadge}>
                  <Ionicons name="logo-google" size={16} color={colors.white} />
                </View>
              )}
              
              {/* Upload button for email users */}
              {isEmailUser && (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleImageUpload}
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Ionicons name="camera" size={20} color={colors.white} />
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* User Info Section */}
            <View style={styles.userInfoSection}>
              {/* Name Field */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Nama</Text>
                <View style={styles.fieldRow}>
                  {isEditing ? (
                    <TextInput
                      style={styles.nameInput}
                      value={editedName}
                      onChangeText={setEditedName}
                      placeholder="Masukkan nama Anda"
                      autoFocus
                      maxLength={50}
                    />
                  ) : (
                    <Text style={styles.fieldValue}>
                      {contextUser?.name || 'Nama belum diatur'}
                    </Text>
                  )}
                  
                  {isEmailUser && (
                    <View style={styles.actionButtons}>
                      {isEditing ? (
                        <>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.cancelButton]}
                            onPress={handleCancelEdit}
                            disabled={isLoading}
                          >
                            <Ionicons name="close" size={16} color={colors.brand} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.saveButton]}
                            onPress={handleSaveName}
                            disabled={isLoading}
                          >
                            <Ionicons name="checkmark" size={16} color={colors.white} />
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.editButton]}
                          onPress={() => setIsEditing(true)}
                        >
                          <Ionicons name="pencil" size={16} color={colors.brand} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
                {isGoogleUser && (
                  <Text style={styles.fieldNote}>
                    Nama dikelola oleh akun Google Anda
                  </Text>
                )}
              </View>

              {/* Email Field */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Email</Text>
                <Text style={styles.fieldValue}>
                  {contextUser?.email || 'Tidak ada email'}
                </Text>
                <Text style={styles.fieldNote}>
                  Email tidak dapat diubah
                </Text>
              </View>

              {/* Account Type */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Tipe Akun</Text>
                <View style={styles.accountTypeContainer}>
                  <View style={[
                    styles.accountTypeBadge,
                    isGoogleUser ? styles.googleAccountBadge : styles.emailAccountBadge
                  ]}>
                    <Ionicons
                      name={isGoogleUser ? "logo-google" : "mail"}
                      size={14}
                      color={colors.white}
                    />
                    <Text style={styles.accountTypeText}>
                      {isGoogleUser ? 'Akun Google' : 'Akun Email'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={20} color={colors.brand} />
              <Text style={styles.infoTitle}>Informasi Akun</Text>
            </View>
            <Text style={styles.infoText}>
              {isGoogleUser
                ? 'Akun Anda terhubung dengan Google. Informasi profil dikelola melalui akun Google Anda.'
                : 'Anda dapat mengedit nama Anda kapan saja. Alamat email tidak dapat diubah untuk alasan keamanan.'}
            </Text>
          </View>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    paddingVertical: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  profileCard: {
    backgroundColor: colors.white,
    marginBottom: 16,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.white,
  },
  googleBadge: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: colors.danger,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  uploadButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: colors.brand,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  userInfoSection: {
    gap: 20,
  },
  fieldContainer: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldValue: {
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
  },
  fieldNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: colors.brand,
    paddingVertical: 4,
    marginRight: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: colors.incomeBg,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  saveButton: {
    backgroundColor: colors.brand,
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountTypeContainer: {
    flexDirection: 'row',
  },
  accountTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  googleAccountBadge: {
    backgroundColor: colors.danger,
  },
  emailAccountBadge: {
    backgroundColor: colors.brand,
  },
  accountTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  infoCard: {
    backgroundColor: colors.white,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
