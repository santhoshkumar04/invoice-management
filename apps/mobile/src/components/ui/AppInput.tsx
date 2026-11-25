// import {
//   StyleSheet,
//   Text,
//   TextInput,
//   View,
//   TextInputProps,
// } from "react-native";

// import { colors } from "../../theme/colors";
// import { radius, spacing } from "../../theme/spacing";

// interface Props extends TextInputProps {
//   label: string;
//   error?: string;
// }

// export function AppInput({ label, error, ...props }: Props) {
//   return (
//     <View style={styles.container}>
//       <Text style={styles.label}>{label}</Text>

//       <TextInput
//         placeholderTextColor={colors.textSecondary}
//         style={[styles.input, error ? styles.errorInput : null]}
//         {...props}
//       />

//       {error ? <Text style={styles.errorText}>{error}</Text> : null}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     gap: spacing.sm,
//   },
//   label: {
//     color: colors.text,
//     fontSize: 14,
//     fontWeight: "600",
//   },
//   input: {
//     height: 52,
//     borderWidth: 1,
//     borderColor: colors.border,
//     borderRadius: radius.md,
//     paddingHorizontal: 14,
//     fontSize: 15,
//     color: colors.text,
//     backgroundColor: colors.surface,
//   },
//   errorInput: {
//     borderColor: colors.danger,
//   },
//   errorText: {
//     color: colors.danger,
//     fontSize: 12,
//   },
// });

import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TextInputProps,
  Pressable,
} from "react-native";

import { Eye, EyeOff } from "lucide-react-native";

import { colors } from "../../theme/colors";
import { radius, spacing } from "../../theme/spacing";

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;

  // Icons
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;

  // Password support
  isPassword?: boolean;

  // Container customization
  containerStyle?: object;
  inputContainerStyle?: object;
  labelStyle?: object;

  // Visibility toggle customization
  showPasswordToggle?: boolean;
}

export function AppInput({
  label,
  error,
  helperText,
  required = false,
  prefix,
  suffix,
  isPassword = false,
  showPasswordToggle = true,
  containerStyle,
  inputContainerStyle,
  labelStyle,
  secureTextEntry,
  editable = true,
  ...props
}: AppInputProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);

  const shouldShowPasswordToggle = isPassword && showPasswordToggle;

  const isSecure = shouldShowPasswordToggle
    ? !passwordVisible
    : secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[styles.label, labelStyle]}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          error ? styles.errorInput : null,
          !editable ? styles.disabledInput : null,
          inputContainerStyle,
        ]}
      >
        {prefix ? <View style={styles.iconContainer}>{prefix}</View> : null}

        <TextInput
          {...props}
          editable={editable}
          secureTextEntry={isSecure}
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        {shouldShowPasswordToggle ? (
          <Pressable
            onPress={() => setPasswordVisible((current) => !current)}
            style={styles.iconContainer}
            accessibilityRole="button"
            accessibilityLabel={
              passwordVisible ? "Hide password" : "Show password"
            }
            hitSlop={8}
          >
            {suffix ??
              (passwordVisible ? (
                <EyeOff size={19} color={colors.textSecondary} />
              ) : (
                <Eye size={19} color={colors.textSecondary} />
              ))}
          </Pressable>
        ) : suffix ? (
          <View style={styles.iconContainer}>{suffix}</View>
        ) : null}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },

  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },

  required: {
    color: colors.danger,
  },

  inputContainer: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },

  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },

  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },

  errorInput: {
    borderColor: colors.danger,
  },

  disabledInput: {
    opacity: 0.55,
  },

  errorText: {
    color: colors.danger,
    fontSize: 12,
  },

  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  toggleText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
});
