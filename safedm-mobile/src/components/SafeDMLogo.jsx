import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { brandAspect, brandImages } from "../assets/brand";

/**
 * Marque Safeguard DM.
 * @param {'icon'|'full'|'text'} variant
 * @param {number} size — height in dp (width from aspect; icon is square)
 */
export default function SafeDMLogo({ size = 40, variant = "icon" }) {
  const source = brandImages[variant] || brandImages.icon;
  const aspect = brandAspect[variant] || brandAspect.icon;
  const height = size;
  const width = Math.round(size * aspect);

  // Full / text can be wide — cap width so headers don't overflow.
  const maxWidth = variant === "icon" ? size : Math.round(size * 4.2);
  const finalWidth = Math.min(width, maxWidth);
  const finalHeight =
    variant === "icon" ? size : Math.round(finalWidth / aspect);

  return (
    <View style={{ width: finalWidth, height: finalHeight }}>
      <Image
        source={source}
        style={[
          styles.img,
          {
            width: finalWidth,
            height: finalHeight,
          },
        ]}
        resizeMode="contain"
        accessibilityLabel="SafeDM"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  img: {
    // Source PNGs are transparent — no white box behind the mark.
  },
});
