import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme/tokens";

/**
 * Logo maquette SafeDM — loupe noire, lentille bleue, 3 segments signal.
 */
export default function SafeDMLogo({ size = 40 }) {
  const u = size / 64;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.signal,
          {
            width: 7 * u,
            height: 7 * u,
            borderRadius: 1.5 * u,
            top: 4 * u,
            left: 28 * u,
          },
        ]}
      />
      <View
        style={[
          styles.signal,
          {
            width: 7 * u,
            height: 7 * u,
            borderRadius: 1.5 * u,
            top: 10 * u,
            left: 14 * u,
            transform: [{ rotate: "-28deg" }],
          },
        ]}
      />
      <View
        style={[
          styles.signal,
          {
            width: 7 * u,
            height: 7 * u,
            borderRadius: 1.5 * u,
            top: 10 * u,
            left: 42 * u,
            transform: [{ rotate: "28deg" }],
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          {
            width: 34 * u,
            height: 34 * u,
            borderRadius: 17 * u,
            borderWidth: 4 * u,
            top: 16 * u,
            left: 10 * u,
          },
        ]}
      />
      <View
        style={[
          styles.lens,
          {
            width: 18 * u,
            height: 18 * u,
            borderRadius: 9 * u,
            top: 24 * u,
            left: 18 * u,
          },
        ]}
      />
      <View
        style={[
          styles.handle,
          {
            width: 6 * u,
            height: 18 * u,
            borderRadius: 3 * u,
            top: 44 * u,
            left: 42 * u,
            transform: [{ rotate: "40deg" }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  signal: {
    position: "absolute",
    backgroundColor: colors.bluePrimary,
  },
  ring: {
    position: "absolute",
    borderColor: colors.black,
    backgroundColor: "transparent",
  },
  lens: {
    position: "absolute",
    backgroundColor: colors.bluePrimary,
  },
  handle: {
    position: "absolute",
    backgroundColor: colors.black,
  },
});
