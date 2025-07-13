app/components/Button.js

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  StyleSheet,
  Platform
} from 'react-native';
import { tw } from '../lib/tailwind';
import { useTheme } from 'react-native-paper';

const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  iconPosition = 'left',
  accessibilityLabel,
  testID
}) => {
  const theme = useTheme();
  
  // Variant styles
  const variantStyles = {
    primary: {
      container: `bg-${theme.colors.primary} border border-transparent`,
      text: `text-white`,
      pressed: `bg-${theme.colors.primaryDark}`,
      disabled: `bg-gray-300`,
    },
    secondary: {
      container: `bg-white border border-${theme.colors.primary}`,
      text: `text-${theme.colors.primary}`,
      pressed: `bg-${theme.colors.primary} bg-opacity-10`,
      disabled: `bg-gray-100 border-gray-300`,
    },
    text: {
      container: 'bg-transparent',
      text: `text-${theme.colors.primary}`,
      pressed: `bg-${theme.colors.primary} bg-opacity-10`,
      disabled: 'opacity-60',
    },
    danger: {
      container: `bg-red-600 border border-transparent`,
      text: 'text-white',
      pressed: 'bg-red-700',
      disabled: 'bg-red-300',
    },
  };

  // Size styles
  const sizeStyles = {
    sm: {
      container: 'py-1 px-3',
      text: 'text-sm',
      iconSize: 16,
    },
    md: {
      container: 'py-2 px-4',
      text: 'text-base',
      iconSize: 20,
    },
    lg: {
      container: 'py-3 px-6',
      text: 'text-lg',
      iconSize: 24,
    },
  };

  // Get current styles based on variant and size
  const currentVariant = variantStyles[variant] || variantStyles.primary;
  const currentSize = sizeStyles[size] || sizeStyles.md;

  // Handle disabled state
  const isDisabled = disabled || loading;
  const disabledStyle = isDisabled ? currentVariant.disabled : '';
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        tw(
          `rounded-lg flex-row items-center justify-center ${currentVariant.container} ${currentSize.container} ${fullWidth ? 'w-full' : ''} ${disabledStyle}`
        ),
        style,
      ]}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
      testID={testID || 'button'}
    >
      {loading ? (
        <ActivityIndicator 
          size={currentSize.iconSize} 
          color={
            variant === 'secondary' 
              ? theme.colors.primary 
              : variant === 'text' 
                ? theme.colors.primary 
                : '#ffffff'
          } 
        />
      ) : (
        <>
          {Icon && iconPosition === 'left' && (
            <View style={tw('mr-2')}>
              <Icon 
                size={currentSize.iconSize} 
                color={
                  variant === 'secondary' 
                    ? theme.colors.primary 
                    : variant === 'text' 
                      ? theme.colors.primary 
                      : '#ffffff'
                } 
              />
            </View>
          )}
          
          <Text
            style={[
              tw(`${currentVariant.text} ${currentSize.text} font-medium`),
              textStyle,
              isDisabled && variant !== 'text' && tw('text-gray-500'),
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          
          {Icon && iconPosition === 'right' && (
            <View style={tw('ml-2')}>
              <Icon 
                size={currentSize.iconSize} 
                color={
                  variant === 'secondary' 
                    ? theme.colors.primary 
                    : variant === 'text' 
                      ? theme.colors.primary 
                      : '#ffffff'
                } 
              />
            </View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

export default Button;