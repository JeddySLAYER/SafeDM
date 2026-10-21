#!/usr/bin/env bash
#
# Compile les sources Kotlin natives hors EAS.
#
# Pourquoi ce script existe : un build EAS distant passe ~30 minutes avant
# d'echouer sur `:app:compileReleaseKotlin`. Les erreurs les plus frequentes
# (visibilite de paquet d'un membre Java, import manquant entre deux fichiers
# Kotlin natifs) ne sont visibles qu'a ce moment-la, sur la machine EAS, avec
# un log de 2000 lignes. Ce script rejoue l'etape de compilation en local en
# quelques minutes.
#
# Usage :
#   scripts/android-compile.sh            # rejoue le prebuild puis compile
#   scripts/android-compile.sh --clean    # regenere android/ depuis zero
#
# Variables d'environnement :
#   ANDROID_HOME / ANDROID_SDK_ROOT  SDK Android (si local.properties absent)
#   APP_ENV, EAS_BUILD_PROFILE       config a reproduire (defaut : release)

set -euo pipefail

cd "$(dirname "$0")/.."

CLEAN=""
if [[ "${1:-}" == "--clean" ]]; then
  CLEAN="--clean"
fi

# Reproduire le profil EAS "apk" : en release l'app ne doit PAS embarquer
# expo-dev-client, et l'API doit pointer sur la production.
export APP_ENV="${APP_ENV:-production}"
export EAS_BUILD_PROFILE="${EAS_BUILD_PROFILE:-apk}"

echo "==> prebuild android (APP_ENV=$APP_ENV EAS_BUILD_PROFILE=$EAS_BUILD_PROFILE)"
# shellcheck disable=SC2086
npx expo prebuild --platform android --no-install $CLEAN

cd android

if [[ ! -f local.properties ]]; then
  SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/sdk}}"
  if [[ ! -d "$SDK" ]]; then
    echo "::error::SDK Android introuvable : exportez ANDROID_HOME=$SDK" >&2
    exit 1
  fi
  printf 'sdk.dir=%s\n' "$SDK" > local.properties
fi

echo "==> compilation Kotlin (:app:compileReleaseKotlin)"
./gradlew :app:compileReleaseKotlin --console=plain

echo "==> OK : les sources Kotlin natives compilent."
