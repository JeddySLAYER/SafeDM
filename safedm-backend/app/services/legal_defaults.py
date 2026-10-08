"""Textes initiaux. L'admin peut les remplacer ; chaque enregistrement augmente la version."""

PRIVACY_BODY = """SafeDM protège vos messages d'abord sur le téléphone.

Ce que l'application lit
SafeDM peut lire les notifications des applications que vous choisissez, uniquement pour repérer un message suspect. Le texte n'est pas modifié et n'est pas bloqué.

Ce qui reste sur le téléphone
L'analyse locale, l'historique des alertes (7 jours) et la liste des applications surveillées restent sur l'appareil, sauf si vous demandez une vérification distante.

Vérification distante
Si vous l'acceptez, le texte du message peut être envoyé à SafeDM pour une analyse complémentaire. Vous pouvez refuser. Sans cet accord, le message ne quitte pas le téléphone.

Ce que nous ne faisons pas
Nous ne vendons pas vos messages. Nous ne les publions pas. Un signalement volontaire est séparé de l'analyse automatique.

Vos choix
Vous pouvez désactiver la vérification distante, effacer l'historique et retirer l'accès aux notifications dans les réglages du téléphone."""

TERMS_BODY = """En utilisant SafeDM, vous acceptez ces règles simples.

SafeDM vous aide à repérer des messages et des liens suspects. Ce n'est pas une garantie : un message peut être signalé à tort, ou passer inaperçu.

Vous choisissez les applications surveillées et les accès Android nécessaires. Vous pouvez les retirer à tout moment.

Vous ne devez pas utiliser SafeDM pour nuire à quelqu'un, ni envoyer volontairement des contenus illégaux.

Le service peut évoluer. Si cette politique change, l'application vous demandera de l'accepter à nouveau."""

DEFAULT_DOCUMENTS = (
    {
        "slug": "privacy",
        "title": "Politique de confidentialité",
        "body": PRIVACY_BODY.strip(),
    },
    {
        "slug": "terms",
        "title": "Conditions d'utilisation",
        "body": TERMS_BODY.strip(),
    },
)
