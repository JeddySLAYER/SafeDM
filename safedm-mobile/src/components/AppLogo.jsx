import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { IconBadge } from "./Icons";
import { resolveAppIcon } from "../services/appIcons";
import { colors } from "../theme/tokens";

/**
 * Affiche le vrai logo Android :
 * - `uri` directe (file:// déjà connue), ou
 * - `packageName` résolu via le bridge natif,
 * - sinon glyph `fallbackIcon`.
 */
export default function AppLogo({
  uri: uriProp,
  packageName,
  fallbackIcon = "bell",
  size = 40,
  style,
}) {
  const [resolvedUri, setResolvedUri] = useState(uriProp || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (uriProp) {
      setResolvedUri(uriProp);
      return undefined;
    }
    let cancelled = false;
    setResolvedUri(null);
    if (!packageName) return undefined;
    resolveAppIcon(packageName).then((value) => {
      if (!cancelled) setResolvedUri(value);
    });
    return () => {
      cancelled = true;
    };
  }, [uriProp, packageName]);

  if (resolvedUri && !failed) {
    return (
      <Image
        source={{ uri: resolvedUri }}
        style={[
          styles.icon,
          { width: size, height: size, borderRadius: Math.max(8, size * 0.25) },
          style,
        ]}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }

  if (fallbackIcon) {
    return <IconBadge name={fallbackIcon} size={size} />;
  }

  return (
    <View
      style={[
        styles.icon,
        styles.placeholder,
        { width: size, height: size, borderRadius: Math.max(8, size * 0.25) },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    backgroundColor: colors.blueSoft,
  },
  placeholder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
});
