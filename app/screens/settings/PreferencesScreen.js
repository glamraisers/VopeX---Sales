app/screens/settings/PreferencesScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, RefreshControl, View, StyleSheet } from 'react-native';
import { 
  Surface, 
  Text, 
  Switch, 
  Divider, 
  Button, 
  ActivityIndicator, 
  Snackbar,
  List,
  HelperText
} from 'react-native-paper';
import { useTailwind } from 'tailwind-rn';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../../contexts/ThemeContext';

const PreferencesScreen = () => {
  const tailwind = useTailwind();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [preferences, setPreferences] = useState({
    theme: 'system',
    notifications: true,
    biometrics: false,
    aiAssistance: true,
    syncFrequency: 'daily',
    language: 'en'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Check biometric availability
  useEffect(() => {
    const checkBiometrics = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
    };
    
    checkBiometrics();
  }, []);

  // Load user preferences
  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (data) {
        setPreferences(data.preferences);
        // Apply theme immediately
        if (data.preferences.theme && data.preferences.theme !== 'system') {
          setTheme(data.preferences.theme);
        }
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
      setError('Failed to load preferences. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.id, setTheme]);

  // Save preferences
  const savePreferences = useCallback(async (newPrefs) => {
    try {
      setSaving(true);
      setError(null);
      
      const { error: upsertError } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          preferences: newPrefs,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;

      setPreferences(newPrefs);
      setSnackbarVisible(true);
      
      // Apply theme immediately if changed
      if (newPrefs.theme && newPrefs.theme !== preferences.theme) {
        setTheme(newPrefs.theme);
      }
    } catch (err) {
      console.error('Error saving preferences:', err);
      setError('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [user.id, preferences.theme, setTheme]);

  // Handle preference change
  const handlePreferenceChange = useCallback(async (key, value) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    await savePreferences(newPrefs);
  }, [preferences, savePreferences]);

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPreferences();
  }, [loadPreferences]);

  // Initialize
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Sync frequency options
  const syncOptions = [
    { label: 'Every 15 minutes', value: '15min' },
    { label: 'Hourly', value: 'hourly' },
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
  ];

  // Language options
  const languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Spanish', value: 'es' },
    { label: 'French', value: 'fr' },
    { label: 'German', value: 'de' },
  ];

  if (loading) {
    return (
      <View style={tailwind('flex-1 justify-center items-center')}>
        <ActivityIndicator size="large" />
        <Text style={tailwind('mt-4 text-gray-600')}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={tailwind('p-4 pb-8')}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Theme Preferences */}
      <Surface style={[styles.section, tailwind('mb-6')]}>
        <Text style={styles.sectionTitle}>Display</Text>
        
        <List.Item
          title="Theme"
          description="Set light or dark mode"
          right={() => (
            <View style={tailwind('flex-row items-center')}>
              <Button
                mode={preferences.theme === 'light' ? 'contained' : 'outlined'}
                onPress={() => handlePreferenceChange('theme', 'light')}
                compact
                style={tailwind('mr-2')}
              >
                Light
              </Button>
              <Button
                mode={preferences.theme === 'dark' ? 'contained' : 'outlined'}
                onPress={() => handlePreferenceChange('theme', 'dark')}
                compact
                style={tailwind('mr-2')}
              >
                Dark
              </Button>
              <Button
                mode={preferences.theme === 'system' ? 'contained' : 'outlined'}
                onPress={() => handlePreferenceChange('theme', 'system')}
                compact
              >
                System
              </Button>
            </View>
          )}
        />
      </Surface>

      {/* Security Preferences */}
      <Surface style={[styles.section, tailwind('mb-6')]}>
        <Text style={styles.sectionTitle}>Security</Text>
        
        <List.Item
          title="Enable Biometrics"
          description="Use fingerprint or face recognition"
          right={() => (
            <Switch
              value={preferences.biometrics && biometricAvailable}
              onValueChange={(value) => handlePreferenceChange('biometrics', value)}
              disabled={!biometricAvailable || saving}
            />
          )}
        />
        {!biometricAvailable && (
          <HelperText type="info" style={tailwind('px-4')}>
            Biometric authentication is not available on this device
          </HelperText>
        )}
      </Surface>

      {/* Notification Preferences */}
      <Surface style={[styles.section, tailwind('mb-6')]}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        
        <List.Item
          title="Enable Notifications"
          description="Receive app notifications"
          right={() => (
            <Switch
              value={preferences.notifications}
              onValueChange={(value) => handlePreferenceChange('notifications', value)}
              disabled={saving}
            />
          )}
        />
      </Surface>

      {/* AI Preferences */}
      <Surface style={[styles.section, tailwind('mb-6')]}>
        <Text style={styles.sectionTitle}>AI Assistance</Text>
        
        <List.Item
          title="Enable AI Features"
          description="Use AI for sales predictions and insights"
          right={() => (
            <Switch
              value={preferences.aiAssistance}
              onValueChange={(value) => handlePreferenceChange('aiAssistance', value)}
              disabled={saving}
            />
          )}
        />
      </Surface>

      {/* Sync Preferences */}
      <Surface style={[styles.section, tailwind('mb-6')]}>
        <Text style={styles.sectionTitle}>Data Sync</Text>
        
        <List.Item
          title="Sync Frequency"
          description="How often data syncs with server"
          right={() => (
            <View style={tailwind('w-48')}>
              {syncOptions.map((option) => (
                <Button
                  key={option.value}
                  mode={preferences.syncFrequency === option.value ? 'contained' : 'outlined'}
                  onPress={() => handlePreferenceChange('syncFrequency', option.value)}
                  compact
                  style={tailwind('my-1')}
                >
                  {option.label}
                </Button>
              ))}
            </View>
          )}
        />
      </Surface>

      {/* Language Preferences */}
      <Surface style={[styles.section, tailwind('mb-6')]}>
        <Text style={styles.sectionTitle}>Language</Text>
        
        <List.Item
          title="App Language"
          description="Set your preferred language"
          right={() => (
            <View style={tailwind('w-36')}>
              {languageOptions.map((option) => (
                <Button
                  key={option.value}
                  mode={preferences.language === option.value ? 'contained' : 'outlined'}
                  onPress={() => handlePreferenceChange('language', option.value)}
                  compact
                  style={tailwind('my-1')}
                >
                  {option.label}
                </Button>
              ))}
            </View>
          )}
        />
      </Surface>

      {/* Reset to Defaults */}
      <Button
        mode="outlined"
        onPress={() => {
          const defaultPrefs = {
            theme: 'system',
            notifications: true,
            biometrics: false,
            aiAssistance: true,
            syncFrequency: 'daily',
            language: 'en'
          };
          handlePreferenceChange(null, defaultPrefs);
        }}
        style={tailwind('mt-4')}
        loading={saving}
        disabled={saving}
      >
        Reset to Defaults
      </Button>

      {error && (
        <HelperText type="error" style={tailwind('mt-4')}>
          {error}
        </HelperText>
      )}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        Preferences saved successfully!
      </Snackbar>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  section: {
    borderRadius: 12,
    paddingVertical: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});

export default PreferencesScreen;