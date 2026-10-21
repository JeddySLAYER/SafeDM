import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { IconGlyph } from "./Icons";
import { colors } from "../theme/tokens";

/**
 * Actions natives sur une URL suspecte : copier pour la vérifier ailleurs,
 * partager pour la signaler. Deux actions textuelles discretes plutôt qu'un
 * bouton de plus — le bandeau reste la cible principale.
 */
export default function LinkActions({ url, style }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onCopy = useCallback(async () => {
    if (!url) return;
    try {
      await Clipboard.setStringAsync(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }, [url]);

  const onShare = useCallback(async () => {
    if (!url) return;
    try {
      await Share.share({ message: url, url });
    } catch {
      // Feuille de partage annulée ou indisponible : rien à signaler.
    }
  }, [url]);

  if (!url) return null;

  return (
    <View style={[styles.row, style]}>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          copied ? "Lien copié dans le presse-papiers." : `Copier le lien ${url}`
        }
        onPress={onCopy}
        hitSlop={8}
        style={styles.action}
      >
        <IconGlyph
          name={copied ? "check" : "clipboard"}
          color={colors.blue800}
          size={14}
          strokeWidth={2.5}
        />
        <Text style={styles.label}>{copied ? "Copié" : "Copier"}</Text>
      </Pressable>

      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Partager le lien ${url}`}
        onPress={onShare}
        hitSlop={8}
        style={styles.action}
      >
        <IconGlyph name="flag" color={colors.blue800} size={14} strokeWidth={2.5} />
        <Text style={styles.label}>Partager</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 10,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.blue800,
  },
});
