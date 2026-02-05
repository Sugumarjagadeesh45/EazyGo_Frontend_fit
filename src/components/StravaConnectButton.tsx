/**
 * StravaConnectButton Component
 *
 * A reusable button component that opens the Strava mobile app.
 * Automatically falls back to app store or web browser if Strava is not installed.
 *
 * Features:
 * - Platform-aware deep linking (iOS/Android)
 * - Automatic fallback chain: App → Store → Browser
 * - Loading state indicator
 * - Customizable appearance
 * - Accessible with proper labels
 *
 * @example
 * ```tsx
 * // Basic usage
 * <StravaConnectButton />
 *
 * // With custom label
 * <StravaConnectButton label="Connect with Strava" />
 *
 * // Outline variant
 * <StravaConnectButton variant="outline" />
 *
 * // With callback
 * <StravaConnectButton onOpenResult={(result) => console.log(result)} />
 * ```
 */

import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useStravaAppLink, StravaLinkResult } from '../hooks/useStravaAppLink';
import { colors } from '../constants/colors';
import { spacing, borderRadius } from '../constants/spacing';

// Strava brand color
const STRAVA_ORANGE = '#FC4C02';

export type StravaButtonVariant = 'filled' | 'outline';
export type StravaButtonSize = 'small' | 'medium' | 'large';

export interface StravaConnectButtonProps {
  /** Button label text */
  label?: string;

  /** Button style variant */
  variant?: StravaButtonVariant;

  /** Button size */
  size?: StravaButtonSize;

  /** Whether the button is disabled */
  disabled?: boolean;

  /** Callback when open attempt completes */
  onOpenResult?: (result: StravaLinkResult) => void;

  /** Additional container styles */
  style?: ViewStyle;

  /** Additional text styles */
  textStyle?: TextStyle;

  /** Whether to show the Strava icon */
  showIcon?: boolean;

  /** Accessibility label override */
  accessibilityLabel?: string;
}

/**
 * StravaConnectButton - Opens Strava app with fallback to store/browser
 */
export const StravaConnectButton: React.FC<StravaConnectButtonProps> = ({
  label = 'Open Strava',
  variant = 'filled',
  size = 'medium',
  disabled = false,
  onOpenResult,
  style,
  textStyle,
  showIcon = true,
  accessibilityLabel,
}) => {
  const { openStrava, state } = useStravaAppLink();

  const handlePress = useCallback(async () => {
    if (state.isLoading || disabled) return;

    const result = await openStrava();

    if (onOpenResult) {
      onOpenResult(result);
    }
  }, [openStrava, state.isLoading, disabled, onOpenResult]);

  // Determine styles based on variant and size
  const buttonStyles = [
    styles.button,
    styles[`button_${size}`],
    variant === 'filled' ? styles.buttonFilled : styles.buttonOutline,
    (disabled || state.isLoading) && styles.buttonDisabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${size}`],
    variant === 'filled' ? styles.textFilled : styles.textOutline,
    (disabled || state.isLoading) && styles.textDisabled,
    textStyle,
  ];

  const iconColor =
    disabled || state.isLoading
      ? colors.textMuted
      : variant === 'filled'
      ? '#FFFFFF'
      : STRAVA_ORANGE;

  const iconSize = size === 'small' ? 18 : size === 'large' ? 26 : 22;

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={handlePress}
      disabled={disabled || state.isLoading}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      accessibilityState={{
        disabled: disabled || state.isLoading,
        busy: state.isLoading,
      }}
    >
      {state.isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'filled' ? '#FFFFFF' : STRAVA_ORANGE}
          style={styles.loader}
        />
      ) : (
        <View style={styles.content}>
          {showIcon && (
            <MaterialCommunityIcons
              name="strava"
              size={iconSize}
              color={iconColor}
              style={styles.icon}
            />
          )}
          <Text style={textStyles}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },

  // Size variants
  button_small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  button_medium: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  button_large: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },

  // Filled variant
  buttonFilled: {
    backgroundColor: STRAVA_ORANGE,
  },

  // Outline variant
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: STRAVA_ORANGE,
  },

  // Disabled state
  buttonDisabled: {
    backgroundColor: colors.border,
    borderColor: colors.border,
    opacity: 0.6,
  },

  // Content container
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Icon
  icon: {
    marginRight: spacing.sm,
  },

  // Loader
  loader: {
    marginHorizontal: spacing.sm,
  },

  // Text styles
  text: {
    fontWeight: '700',
  },

  // Text size variants
  text_small: {
    fontSize: 14,
  },
  text_medium: {
    fontSize: 16,
  },
  text_large: {
    fontSize: 18,
  },

  // Text color variants
  textFilled: {
    color: '#FFFFFF',
  },
  textOutline: {
    color: STRAVA_ORANGE,
  },

  // Text disabled state
  textDisabled: {
    color: colors.textMuted,
  },
});

export default StravaConnectButton;
