import React, { useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet } from "react-native";
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import * as Haptics from "expo-haptics";
import { Trash2, CheckCircle } from "lucide-react-native";
import { useTheme } from "../hooks/useTheme";

interface SwipeableRowProps {
  children: React.ReactNode;
  onSwipeLeft: () => Promise<boolean>;
  onSwipeRight: () => Promise<boolean>;
  staysVisibleOnRight: boolean;
}

export function SwipeableRow({
  children,
  onSwipeLeft,
  onSwipeRight,
  staysVisibleOnRight,
}: SwipeableRowProps) {
  const { colors } = useTheme();
  const swipeableRef = useRef<SwipeableMethods>(null);
  const exitX = useRef(new Animated.Value(0)).current;
  const actionsOpacity = useRef(new Animated.Value(1)).current;
  const triggeredRef = useRef(false);
  const [exited, setExited] = useState(false);

  const restore = () => {
    triggeredRef.current = false;
    exitX.stopAnimation();
    exitX.setValue(0);
    actionsOpacity.setValue(1);
    swipeableRef.current?.close();
    setExited(false);
  };

  const runExit = (direction: "left" | "right") => {
    const width = Dimensions.get("window").width;
    Animated.parallel([
      Animated.timing(exitX, {
        toValue: direction === "left" ? -width : width,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(actionsOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setExited(true);
    });
  };

  const handleWillOpen = (
    direction: SwipeDirection.LEFT | SwipeDirection.RIGHT,
  ) => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;

    if (direction === SwipeDirection.LEFT) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const result = onSwipeLeft();
      runExit("left");
      result
        .then((ok) => {
          if (!ok) restore();
        })
        .catch(() => restore());
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const stays = staysVisibleOnRight;
    const result = onSwipeRight();
    if (stays) {
      swipeableRef.current?.close();
    } else {
      runExit("right");
    }
    result
      .then((ok) => {
        if (!ok) restore();
      })
      .catch(() => restore());
  };

  if (exited) return null;

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <Animated.View
          style={[
            styles.action,
            { backgroundColor: colors.success, opacity: actionsOpacity },
          ]}
        >
          <CheckCircle color="#fff" size={22} />
        </Animated.View>
      )}
      renderRightActions={() => (
        <Animated.View
          style={[
            styles.action,
            { backgroundColor: colors.destructive, opacity: actionsOpacity },
          ]}
        >
          <Trash2 color="#fff" size={22} />
        </Animated.View>
      )}
      onSwipeableWillOpen={handleWillOpen}
      onSwipeableClose={() => {
        triggeredRef.current = false;
      }}
    >
      <Animated.View style={{ transform: [{ translateX: exitX }] }}>
        {children}
      </Animated.View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 84,
    alignItems: "center",
    justifyContent: "center",
  },
});
