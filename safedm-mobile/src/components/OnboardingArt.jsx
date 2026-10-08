import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "../theme/tokens";

const BLUE = colors.bluePrimary;
const SOFT = colors.blue50;
const INK = colors.textPrimary;
const MUTED = colors.textMuted;

function Frame({ children }) {
  return (
    <Svg width={220} height={180} viewBox="0 0 220 180">
      <Circle cx="110" cy="90" r="78" fill={SOFT} />
      {children}
    </Svg>
  );
}

export default function OnboardingArt({ name }) {
  if (name === "phone") {
    return (
      <Frame>
        <Rect x="78" y="36" width="64" height="108" rx="12" fill={colors.white} stroke={BLUE} strokeWidth="3" />
        <Rect x="90" y="48" width="40" height="8" rx="4" fill={SOFT} />
        <Path d="M98 92l8 8 16-18" stroke={BLUE} strokeWidth="4" fill="none" strokeLinecap="round" />
        <Circle cx="110" cy="128" r="4" fill={MUTED} />
      </Frame>
    );
  }
  if (name === "message") {
    return (
      <Frame>
        <Rect x="46" y="48" width="128" height="72" rx="16" fill={colors.white} stroke={BLUE} strokeWidth="3" />
        <Path d="M70 120l16-16h20" fill={colors.white} stroke={BLUE} strokeWidth="3" />
        <Rect x="64" y="66" width="72" height="8" rx="4" fill={SOFT} />
        <Rect x="64" y="82" width="48" height="8" rx="4" fill={BLUE} />
      </Frame>
    );
  }
  return (
    <Frame>
      <Circle cx="110" cy="86" r="36" fill={colors.white} stroke={BLUE} strokeWidth="3" />
      <Path d="M98 86l8 8 16-18" stroke={BLUE} strokeWidth="4" fill="none" strokeLinecap="round" />
      <Path d="M146 118c18 8 28 4 36-8" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      <Circle cx="186" cy="104" r="6" fill={BLUE} />
    </Frame>
  );
}
