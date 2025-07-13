app/screens/auth/LoginScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  StyleSheet,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Divider,
  ActivityIndicator,
  IconButton,
  Surface,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { validateEmail, validatePassword } from '../../utils/validation';
import { logEvent } from '../../utils/analytics';
import { showToast } from '../../utils/toast';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LoginScreen = () => {
  const theme = useTheme();
  const router = useRouter();
  const { signIn, user, loading: authLoading } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Validation state
  const [touched, setTouched] = useState({});

  // Redirect if already authenticated
  useFocusEffect(
    useCallback(() => {
      if (user && !authLoading) {
        router.replace('/(tabs)/dashboard');
      }
    }, [user, authLoading, router])
  );

  // Form validation
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(password)) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password]);

  // Handle input changes
  const handleEmailChange = useCallback((text) => {
    setEmail(text.trim().toLowerCase());
    if (touched.email && errors.email) {
      setErrors(prev => ({ ...prev, email: null }));
    }
  }, [touched.email, errors.email]);

  const handlePasswordChange = useCallback((text) => {
    setPassword(text);
    if (touched.password && errors.password) {
      setErrors(prev => ({ ...prev, password: null }));
    }
  }, [touched.password, errors.password]);

  // Handle field blur
  const handleBlur = useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  // Toggle password visibility
  const togglePasswordVisibility = useCallback(() => {
    setIsPasswordVisible(prev => !prev);
  }, []);

  // Handle login
  const handleLogin = useCallback(async () => {
    if (!validateForm()) {
      showToast('Please fix the errors above', 'error');
      return;
    }

    setLoading(true);

    try {
      // Log login attempt
      await logEvent('login_attempt', { email });

      // Attempt sign in
      const result = await signIn(email, password);

      if (result.error) {
        throw new Error(result.error.message);
      }

      // Log successful login
      await logEvent('login_success', { email });

      // Show success message
      showToast('Welcome back!', 'success');

      // Navigate to dashboard
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      console.error('Login error:', error);

      // Log failed login
      await logEvent('login_failed', { 
        email, 
        error: error.message,
        timestamp: new Date().toISOString()
      });

      // Handle specific error cases
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and confirm your account.';
      } else if (error.message.includes('Too many requests')) {
        errorMessage = 'Too many login attempts. Please wait a moment and try again.';
      }

      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [email, password, signIn, router, validateForm]);

  // Handle forgot password
  const handleForgotPassword = useCallback(async () => {
    if (!email.trim()) {
      showToast('Please enter your email address first', 'info');
      return;
    }

    if (!validateEmail(email)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.EXPO_PUBLIC_APP_URL}/reset-password`,
      });

      if (error) throw error;

      showToast('Password reset email sent! Check your inbox.', 'success');
      
      // Log password reset request
      await logEvent('password_reset_requested', { email });
    } catch (error) {
      console.error('Password reset error:', error);
      showToast('Failed to send reset email. Please try again.', 'error');
    }
  }, [email]);

  // Navigate to signup
  const handleSignUpPress = useCallback(() => {
    router.push('/auth/signup');
  }, [router]);

  // Show loading state during auth check
  if (authLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="auto" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={[styles.title, { color: theme.colors.primary }]}>
              Welcome Back
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.onSurface }]}>
              Sign in to your VopeX account
            </Text>
          </View>

          {/* Login Form */}
          <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]}>
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                {/* Email Input */}
                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={handleEmailChange}
                  onBlur={() => handleBlur('email')}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  error={touched.email && !!errors.email}
                  disabled={loading}
                  style={styles.input}
                  left={<TextInput.Icon icon="email" />}
                  testID="email-input"
                />
                {touched.email && errors.email && (
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {errors.email}
                  </Text>
                )}

                {/* Password Input */}
                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={handlePasswordChange}
                  onBlur={() => handleBlur('password')}
                  mode="outlined"
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  error={touched.password && !!errors.password}
                  disabled={loading}
                  style={styles.input}
                  left={<TextInput.Icon icon="lock" />}
                  right={
                    <TextInput.Icon
                      icon={isPasswordVisible ? "eye-off" : "eye"}
                      onPress={togglePasswordVisibility}
                    />
                  }
                  testID="password-input"
                />
                {touched.password && errors.password && (
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {errors.password}
                  </Text>
                )}

                {/* Forgot Password */}
                <Button
                  mode="text"
                  onPress={handleForgotPassword}
                  disabled={loading}
                  style={styles.forgotPasswordButton}
                  labelStyle={styles.forgotPasswordText}
                  testID="forgot-password-button"
                >
                  Forgot Password?
                </Button>

                {/* Login Button */}
                <Button
                  mode="contained"
                  onPress={handleLogin}
                  loading={loading}
                  disabled={loading || !email.trim() || !password.trim()}
                  style={styles.loginButton}
                  contentStyle={styles.loginButtonContent}
                  labelStyle={styles.loginButtonText}
                  testID="login-button"
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </Button>

                {/* Divider */}
                <View style={styles.dividerContainer}>
                  <Divider style={styles.divider} />
                  <Text style={[styles.dividerText, { color: theme.colors.onSurface }]}>
                    OR
                  </Text>
                  <Divider style={styles.divider} />
                </View>

                {/* Sign Up Link */}
                <View style={styles.signUpContainer}>
                  <Text style={[styles.signUpText, { color: theme.colors.onSurface }]}>
                    Don't have an account?{' '}
                  </Text>
                  <Button
                    mode="text"
                    onPress={handleSignUpPress}
                    disabled={loading}
                    compact
                    labelStyle={[styles.signUpButtonText, { color: theme.colors.primary }]}
                    testID="signup-button"
                  >
                    Sign Up
                  </Button>
                </View>
              </Card.Content>
            </Card>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.body.fontSize,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    minHeight: SCREEN_HEIGHT - 200,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: TYPOGRAPHY.h1.fontSize,
    fontWeight: TYPOGRAPHY.h1.fontWeight,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: TYPOGRAPHY.body.fontSize,
    textAlign: 'center',
    opacity: 0.7,
  },
  formContainer: {
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  card: {
    backgroundColor: 'transparent',
  },
  cardContent: {
    padding: SPACING.xl,
  },
  input: {
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: TYPOGRAPHY.caption.fontSize,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
  },
  forgotPasswordText: {
    fontSize: TYPOGRAPHY.caption.fontSize,
  },
  loginButton: {
    marginBottom: SPACING.lg,
  },
  loginButtonContent: {
    paddingVertical: SPACING.sm,
  },
  loginButtonText: {
    fontSize: TYPOGRAPHY.button.fontSize,
    fontWeight: TYPOGRAPHY.button.fontWeight,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  divider: {
    flex: 1,
  },
  dividerText: {
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.caption.fontSize,
    opacity: 0.6,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  signUpText: {
    fontSize: TYPOGRAPHY.body.fontSize,
  },
  signUpButtonText: {
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '600',
  },
});

export default LoginScreen;