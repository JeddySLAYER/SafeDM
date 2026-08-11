import React from "react";
import { StyleSheet, View } from "react-native";
import {
  Bell,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Flag,
  GitBranch,
  Globe,
  Home,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  Search,
  Settings,
  Shield,
  TriangleAlert,
  User,
  Users,
} from "lucide-react-native";
import { colors } from "../theme/tokens";

const ICONS = {
  user: User,
  lock: Lock,
  eye: Eye,
  eyeOff: EyeOff,
  home: Home,
  alerts: Bell,
  reports: Flag,
  settings: Settings,
  whatsapp: MessageCircle,
  sms: MessageSquare,
  email: Mail,
  bell: Bell,
  shield: Shield,
  search: Search,
  community: Users,
  guide: BookOpen,
  chevron: ChevronRight,
  back: ChevronLeft,
  logout: LogOut,
  flag: Flag,
  clipboard: ClipboardList,
  check: Check,
  warning: TriangleAlert,
  globe: Globe,
  doc: FileText,
  branch: GitBranch,
  clock: Clock,
};

export function IconGlyph({ name, color = colors.bluePrimary, size = 20, strokeWidth = 2 }) {
  const Icon = ICONS[name] || Search;
  return <Icon color={color} size={size} strokeWidth={strokeWidth} />;
}

export function IconBadge({ name, size = 40, color = colors.bluePrimary }) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <IconGlyph name={name} color={color} size={Math.round(size * 0.42)} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.blue50,
    alignItems: "center",
    justifyContent: "center",
  },
});
