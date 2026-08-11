import React from "react";
import { Image } from "react-native";

/**
 * Icône marque Safeguard DM (simplify-logo).
 * variant="full" = logo complet avec wordmark.
 */
export default function SafeDMLogo({ size = 40, variant = "icon" }) {
  if (variant === "full") {
    const height = size;
    const width = Math.round(size * (512 / 128));
    return (
      <Image
        source={require("../assets/full-logo.png")}
        style={{ width, height, borderRadius: Math.min(8, size * 0.12) }}
        resizeMode="contain"
        accessibilityLabel="Safeguard DM"
      />
    );
  }

  return (
    <Image
      source={require("../assets/simplify-logo.png")}
      style={{
        width: size,
        height: size,
        borderRadius: Math.min(10, size * 0.18),
      }}
      resizeMode="contain"
      accessibilityLabel="Safeguard DM"
    />
  );
}
