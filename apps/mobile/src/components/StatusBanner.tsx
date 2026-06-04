import React, { useEffect, useRef, useState } from "react";
import { Text, Animated, StyleSheet } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";

export function StatusBanner() {
  const { status, clearStatus } = useReadLater();
  const { colors } = useTheme();
  const [rendered, setRendered] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (status.visible) {
      setRendered(true);
      opacity.setValue(1);

      timerRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setRendered(false);
          clearStatus();
        });
      }, 2700);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status.text, status.type, status.visible, clearStatus, opacity]);

  if (!rendered && !status.visible) return null;

  const bgColor =
    status.type === "error"
      ? colors.destructive
      : status.type === "success"
        ? colors.success
        : colors.primary;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: bgColor, opacity }]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{status.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
