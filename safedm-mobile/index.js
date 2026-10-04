import { install } from "react-native-quick-crypto";
import { registerRootComponent } from "expo";
import App from "./App";

install();
registerRootComponent(App);
