app/screens/auth/SignupScreen.js

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  HelperText,
  Divider,
  ActivityIndicator,
  Checkbox,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { authStyles } from '../../styles/authStyles';
import { validateEmail, validatePassword, validateName } from '../../utils/validation';
import { useAuth } from '../../contexts/AuthContext';
import { trackEvent } from '../../utils/analytics';
import { showToast } from '../../utils/toast';

const { width } = Dimensions.get('window');

const SignupScreen = () => {
  const navigation = useNavigation();
  const { signUp, isLoading: authLoading } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    jobTitle: '',
    phoneNumber: '',
  });

  // Validation state
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToMarketing, setAgreedToMarketing] = useState(false);

  // Real-time validation
  useEffect(() => {
    const newErrors = {};

    if (touched.firstName && !validateName(formData.firstName)) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }

    if (touched.lastName && !validateName(formData.lastName)) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }

    if (touched.email && !validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (touched.password && !validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
    }

    if (touched.confirmPassword && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (touched.companyName && formData.companyName.length < 2) {
      newErrors.companyName = 'Company name must be at least 2 characters';
    }

    if (touched.jobTitle && formData.jobTitle.length < 2) {
      newErrors.jobTitle = 'Job title must be at least 2 characters';
    }

    if (touched.phoneNumber && formData.phoneNumber.length > 0) {
      const phoneRegex = /^[+]?[\d\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(formData.phoneNumber)) {
        newErrors.phoneNumber = 'Please enter a valid phone number';
      }
    }

    setErrors(newErrors);
  }, [formData, touched]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleInputBlur = (field) => {
    setTouched(prev => ({
      ...prev,
      [field]: true,
    }));
  };

  const validateForm = () => {
    const requiredFields = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'companyName', 'jobTitle'];
    const newTouched = {};
    
    requiredFields.forEach(field => {
      newTouched[field] = true;
    });
    
    setTouched(newTouched);

    const hasErrors = Object.keys(errors).length > 0 || 
                     requiredFields.some(field => !formData[field]) ||
                     !agreedToTerms;

    if (!agreedToTerms) {
      showToast('Please agree to the Terms and Conditions', 'error');
      return false;
    }

    return !hasErrors;
  };

  const handleSignup = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Track signup attempt
      await trackEvent('signup_attempted', {
        email: formData.email,
        company: formData.companyName,
        job_title: formData.jobTitle,
      });

      // Create user account
      const { user, error } = await signUp({
        email: formData.email,
        password: formData.password,
        userData: {
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          company_name: formData.companyName.trim(),
          job_title: formData.jobTitle.trim(),
          phone_number: formData.phoneNumber.trim(),
          agreed_to_marketing: agreedToMarketing,
          signup_date: new Date().toISOString(),
        },
      });

      if (error) {
        throw error;
      }

      // Track successful signup
      await trackEvent('signup_completed', {
        user_id: user.id,
        email: formData.email,
        company: formData.companyName,
      });

      showToast('Account created successfully! Please check your email to verify your account.', 'success');
      
      // Navigate to email verification screen
      navigation.navigate('EmailVerification', { 
        email: formData.email,
        fromSignup: true,
      });

    } catch (error) {
      console.error('Signup error:', error);
      
      let errorMessage = 'An error occurred during signup. Please try again.';
      
      if (error.message?.includes('already registered')) {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (error.message?.includes('password')) {
        errorMessage = 'Password requirements not met. Please check your password.';
      } else if (error.message?.includes('email')) {
        errorMessage = 'Please enter a valid email address.';
      }

      showToast(errorMessage, 'error');
      
      // Track signup failure
      await trackEvent('signup_failed', {
        email: formData.email,
        error: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    navigation.navigate('Login');
  };

  const handleTermsPress = () => {
    navigation.navigate('Terms');
  };

  const handlePrivacyPress = () => {
    navigation.navigate('Privacy');
  };

  const isFormValid = () => {
    const requiredFields = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'companyName', 'jobTitle'];
    return requiredFields.every(field => formData[field].trim().length > 0) &&
           Object.keys(errors).length === 0 &&
           agreedToTerms;
  };

  return (
    <SafeAreaView style={authStyles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={authStyles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={authStyles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={authStyles.logoContainer}>
            <Title style={authStyles.title}>Create Account</Title>
            <Paragraph style={authStyles.subtitle}>
              Join VopeX Sales to accelerate your sales process
            </Paragraph>
          </View>

          <Card style={authStyles.card}>
            <Card.Content style={authStyles.cardContent}>
              {/* Personal Information */}
              <View style={authStyles.section}>
                <Text style={authStyles.sectionTitle}>Personal Information</Text>
                
                <View style={authStyles.rowContainer}>
                  <View style={[authStyles.inputContainer, { flex: 1, marginRight: 8 }]}>
                    <TextInput
                      label="First Name *"
                      value={formData.firstName}
                      onChangeText={(value) => handleInputChange('firstName', value)}
                      onBlur={() => handleInputBlur('firstName')}
                      mode="outlined"
                      style={authStyles.input}
                      error={touched.firstName && errors.firstName}
                      autoCapitalize="words"
                      autoComplete="given-name"
                      textContentType="givenName"
                    />
                    {touched.firstName && errors.firstName && (
                      <HelperText type="error" visible={true}>
                        {errors.firstName}
                      </HelperText>
                    )}
                  </View>

                  <View style={[authStyles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                    <TextInput
                      label="Last Name *"
                      value={formData.lastName}
                      onChangeText={(value) => handleInputChange('lastName', value)}
                      onBlur={() => handleInputBlur('lastName')}
                      mode="outlined"
                      style={authStyles.input}
                      error={touched.lastName && errors.lastName}
                      autoCapitalize="words"
                      autoComplete="family-name"
                      textContentType="familyName"
                    />
                    {touched.lastName && errors.lastName && (
                      <HelperText type="error" visible={true}>
                        {errors.lastName}
                      </HelperText>
                    )}
                  </View>
                </View>

                <View style={authStyles.inputContainer}>
                  <TextInput
                    label="Email Address *"
                    value={formData.email}
                    onChangeText={(value) => handleInputChange('email', value.toLowerCase())}
                    onBlur={() => handleInputBlur('email')}
                    mode="outlined"
                    style={authStyles.input}
                    error={touched.email && errors.email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                  />
                  {touched.email && errors.email && (
                    <HelperText type="error" visible={true}>
                      {errors.email}
                    </HelperText>
                  )}
                </View>

                <View style={authStyles.inputContainer}>
                  <TextInput
                    label="Phone Number"
                    value={formData.phoneNumber}
                    onChangeText={(value) => handleInputChange('phoneNumber', value)}
                    onBlur={() => handleInputBlur('phoneNumber')}
                    mode="outlined"
                    style={authStyles.input}
                    error={touched.phoneNumber && errors.phoneNumber}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                  />
                  {touched.phoneNumber && errors.phoneNumber && (
                    <HelperText type="error" visible={true}>
                      {errors.phoneNumber}
                    </HelperText>
                  )}
                </View>
              </View>

              <Divider style={authStyles.divider} />

              {/* Professional Information */}
              <View style={authStyles.section}>
                <Text style={authStyles.sectionTitle}>Professional Information</Text>
                
                <View style={authStyles.inputContainer}>
                  <TextInput
                    label="Company Name *"
                    value={formData.companyName}
                    onChangeText={(value) => handleInputChange('companyName', value)}
                    onBlur={() => handleInputBlur('companyName')}
                    mode="outlined"
                    style={authStyles.input}
                    error={touched.companyName && errors.companyName}
                    autoCapitalize="words"
                    autoComplete="organization"
                    textContentType="organizationName"
                  />
                  {touched.companyName && errors.companyName && (
                    <HelperText type="error" visible={true}>
                      {errors.companyName}
                    </HelperText>
                  )}
                </View>

                <View style={authStyles.inputContainer}>
                  <TextInput
                    label="Job Title *"
                    value={formData.jobTitle}
                    onChangeText={(value) => handleInputChange('jobTitle', value)}
                    onBlur={() => handleInputBlur('jobTitle')}
                    mode="outlined"
                    style={authStyles.input}
                    error={touched.jobTitle && errors.jobTitle}
                    autoCapitalize="words"
                    autoComplete="job-title"
                    textContentType="jobTitle"
                  />
                  {touched.jobTitle && errors.jobTitle && (
                    <HelperText type="error" visible={true}>
                      {errors.jobTitle}
                    </HelperText>
                  )}
                </View>
              </View>

              <Divider style={authStyles.divider} />

              {/* Password Section */}
              <View style={authStyles.section}>
                <Text style={authStyles.sectionTitle}>Security</Text>
                
                <View style={authStyles.inputContainer}>
                  <TextInput
                    label="Password *"
                    value={formData.password}
                    onChangeText={(value) => handleInputChange('password', value)}
                    onBlur={() => handleInputBlur('password')}
                    mode="outlined"
                    style={authStyles.input}
                    error={touched.password && errors.password}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    right={
                      <TextInput.Icon
                        icon={showPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowPassword(!showPassword)}
                      />
                    }
                  />
                  {touched.password && errors.password && (
                    <HelperText type="error" visible={true}>
                      {errors.password}
                    </HelperText>
                  )}
                </View>

                <View style={authStyles.inputContainer}>
                  <TextInput
                    label="Confirm Password *"
                    value={formData.confirmPassword}
                    onChangeText={(value) => handleInputChange('confirmPassword', value)}
                    onBlur={() => handleInputBlur('confirmPassword')}
                    mode="outlined"
                    style={authStyles.input}
                    error={touched.confirmPassword && errors.confirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    right={
                      <TextInput.Icon
                        icon={showConfirmPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      />
                    }
                  />
                  {touched.confirmPassword && errors.confirmPassword && (
                    <HelperText type="error" visible={true}>
                      {errors.confirmPassword}
                    </HelperText>
                  )}
                </View>
              </View>

              <Divider style={authStyles.divider} />

              {/* Terms and Conditions */}
              <View style={authStyles.checkboxContainer}>
                <Checkbox
                  status={agreedToTerms ? 'checked' : 'unchecked'}
                  onPress={() => setAgreedToTerms(!agreedToTerms)}
                  color={authStyles.primaryColor}
                />
                <View style={authStyles.checkboxTextContainer}>
                  <Text style={authStyles.checkboxText}>
                    I agree to the{' '}
                    <Text style={authStyles.linkText} onPress={handleTermsPress}>
                      Terms and Conditions
                    </Text>
                    {' '}and{' '}
                    <Text style={authStyles.linkText} onPress={handlePrivacyPress}>
                      Privacy Policy
                    </Text>
                  </Text>
                </View>
              </View>

              <View style={authStyles.checkboxContainer}>
                <Checkbox
                  status={agreedToMarketing ? 'checked' : 'unchecked'}
                  onPress={() => setAgreedToMarketing(!agreedToMarketing)}
                  color={authStyles.primaryColor}
                />
                <View style={authStyles.checkboxTextContainer}>
                  <Text style={authStyles.checkboxText}>
                    I would like to receive marketing communications and product updates
                  </Text>
                </View>
              </View>

              {/* Sign Up Button */}
              <Button
                mode="contained"
                onPress={handleSignup}
                loading={isLoading || authLoading}
                disabled={!isFormValid() || isLoading || authLoading}
                style={authStyles.button}
                contentStyle={authStyles.buttonContent}
              >
                {isLoading || authLoading ? 'Creating Account...' : 'Create Account'}
              </Button>

              {/* Login Redirect */}
              <View style={authStyles.redirectContainer}>
                <Text style={authStyles.redirectText}>
                  Already have an account?{' '}
                  <TouchableOpacity onPress={handleLoginRedirect}>
                    <Text style={authStyles.linkText}>Sign In</Text>
                  </TouchableOpacity>
                </Text>
              </View>
            </Card.Content>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignupScreen;