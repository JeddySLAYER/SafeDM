import React from "react";
import { SvgXml } from "react-native-svg";
import { storysetIllustrations } from "../assets/storysetIllustrations";

export default function OnboardingArt({ name }) {
  const xml = storysetIllustrations[name] || storysetIllustrations.phone;
  return <SvgXml xml={xml} width={280} height={240} />;
}
