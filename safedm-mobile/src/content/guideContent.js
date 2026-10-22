/**
 * Guide de bonnes pratiques — contenu local.
 *
 * Pourquoi local et pas dans l'API ?
 * ---------------------------------
 * Le guide est consultable hors ligne, sans authentification, et doit
 * s'ouvrir instantanement : c'est la premiere reflexe qu'on cherche quand on
 * recoit un message suspect. Le serveur reste la source de verite pour le
 * CMS d'administration (categories / articles), ajoute en surcouche quand il
 * repond ; ce contenu local est le socle, jamais une page vide.
 *
 * Le format est structure, pas narratif : chaque situation se lit comme une
 * suite d'etapes (red flags a reconnaitre, reflexes a appliquer, actions a
 * lancer), parce qu'un mur de texte n'aide pas a decider quoi faire.
 */

/** Les reflexes a prendre, coat par coat. */
export const REFLEXES = [
  {
    id: "prendre-son-temps",
    title: "Prendre son temps",
    detail:
      "L'urgence est l'outil de l'escroc, pas celui de la banque. Un message urgent se relit demain matin : la menace, elle, ne disparaît pas.",
    example: "« Votre compte sera bloqué dans 2 heures »",
  },
  {
    id: "jamais-un-code",
    title: "Ne jamais donner un code reçu par SMS",
    detail:
      "Ce code prouve que c'est vous. Ni votre banque, ni un service technique, ni un proche n'a le droit de vous le demander.",
    example: "« Donnez-moi le code que vous venez de recevoir »",
  },
  {
    id: "revenir-par-soi-meme",
    title: "Revenir par soi-même",
    detail:
      "N'utilisez jamais le lien du message. Ouvrez l'application ou le site officiel, ou appelez le numéro que vous connaissez déjà.",
    example: "Le lien « €ht.ly/… » au lieu du site de votre banque",
  },
  {
    id: "coller-avant-d-ouvrir",
    title: "Coller le lien avant de l'ouvrir",
    detail:
      "SafeDM analyse le lien sans l'ouvrir et sans envoyer le texte à un tiers. C'est plus sûr que d'essayer de deviner d'un coup d'œil.",
    example: "Un lien dans un SMS de livraison",
  },
  {
    id: "verifier-le-numero",
    title: "Vérifier le numéro, pas le nom affiché",
    detail:
      "Un expéditeur peut s'appeler « MaBanque » tout en écrivant depuis un numéro inconnu. L'ARN ne trompe pas : c'est lui qui compte.",
    example: "+33 6 12 34 56 78 se présente comme « Service client »",
  },
  {
    id: "signaler-meme-apres-clic",
    title: "Signaler, même après avoir cliqué",
    detail:
      "Un signalement tardif protège encore quelqu'un. Si vous avez saisi des informations, changez le mot de passe depuis le site officiel — jamais depuis le message.",
    example: "Un lien déjà ouvert, une erreur déjà commise",
  },
];

/**
 * Situations courantes.
 *
 * `redFlags` : ce qui doit mettre la puce à l'oreille (l'utilisateur peut
 *               reveler chaque indice pour comprendre pourquoi).
 * `reflex`   : la conduite a tenir, dans l'ordre.
 * `actions`  : ce que l'application sait faire pour aider (analyser, signaler).
 */
export const SCENARIOS = [
  {
    id: "phishing",
    icon: "shield",
    title: "Le faux message de banque",
    tagline: "Une banque qui menace de couper votre carte.",
    situation:
      "Vous recevez un SMS ou un e-mail qui semble venir de votre banque : votre carte est bloquée, votre compte va être fermé, ou un paiement est contesté.",
    redFlags: [
      {
        label: "Une urgence artificielle",
        why: "« Dans 24 heures », « immédiatement », « dernier avertissement » : la pression sert à empêcher la vérification.",
      },
      {
        label: "Un lien ou un numéro à appeler",
        why: "Le vrai canal de la banque est déjà dans votre application. Un lien dans un message est un canal pirate.",
      },
      {
        label: "Une demande d'information",
        why: "Numéro de carte complet, code, identifiant, mot de passe : aucune banque ne les demande par message.",
      },
      {
        label: "Un ton qui ne colle pas",
        why: "Fautes d'orthographe, générique (« cher client ») ou au contraire un discours trop flatteur : ce n'est pas la langue de votre banque.",
      },
    ],
    reflex: [
      "Ne touchez à rien : ni le lien, ni le numéro.",
      "Ouvrez l'application de votre banque, ou appelez le numéro inscrit sur votre carte.",
      "Si le message vous prédit un problème, vérifiez-le depuis l'application : c'est là que la vérité se trouve.",
    ],
    actions: [
      { label: "Analyser ce message", action: "analyze" },
      { label: "Signaler ce message", action: "report" },
    ],
    related: ["otp", "securite-factice"],
  },
  {
    id: "otp",
    icon: "lock",
    title: "Le code reçu par SMS",
    tagline: "Quelqu'un vous demande un code que vous venez de recevoir.",
    situation:
      "Une personne se présente au téléphone ou par message : support technique, livreur, service client, ou même un proche. Elle vous demande le code que vous venez de recevoir.",
    redFlags: [
      {
        label: "Le code ne lui appartient pas",
        why: "Le code a été généré à l'instant pour vous. Il ne peut servir à personne d'autre — sauf à quelqu'un qui a déclenché la demande.",
      },
      {
        label: "Une demande de « vérification »",
        why: "On vous persuade de dire le code à voix haute pour « confirmer votre identité ». C'est l'inverse du but d'un code.",
      },
      {
        label: "Un ton d'urgence ou de secret",
        why: "« Ne dites à personne que je vous appelle », « c'est confidentiel » : on veut empêcher un tiers de vous prévenir.",
      },
    ],
    reflex: [
      "Ne communiquez jamais le code, même partiellement.",
      "Raccrochez et rappelez le numéro officiel, trouvé sur votre carte ou sur le site.",
      "Si vous avez déjà donné le code, changez le mot de passe immédiatement et prévenez votre banque.",
    ],
    actions: [
      { label: "Analyser ce message", action: "analyze" },
      { label: "Signaler ce message", action: "report" },
    ],
    related: ["phishing", "annonce"],
  },
  {
    id: "colis",
    icon: "guide",
    title: "Le colis et les frais de douane",
    tagline: "Une livraison que vous n'avez pas commandée.",
    situation:
      "Un SMS vous annonce un colis bloqué, une erreur d'adresse, ou des frais de douane à régler.",
    redFlags: [
      {
        label: "Vous n'avez rien commandé",
        why: "Le message s'appuie sur une commande existante : c'est le détail qui rend l'arnaque crédible.",
      },
      {
        label: "Des frais à payer",
        why: "Un transporteur ne demande jamais de frais par SMS avec un lien de paiement.",
      },
      {
        label: "Un lien raccourci",
        why: "Une adresse courte cache la vraie destination : impossible de savoir où elle mène avant de l'ouvrir.",
      },
    ],
    reflex: [
      "N'ouvrez pas le lien.",
      "Ouvrez l'application du transporteur, ou le site officiel, et vérifiez vos colis.",
      "Si le colis n'existe pas, supprimez le message et ne payez rien.",
    ],
    actions: [
      { label: "Analyser ce lien", action: "analyze" },
      { label: "Signaler ce message", action: "report" },
    ],
    related: ["lien-court"],
  },
  {
    id: "lien-court",
    icon: "globe",
    title: "Le lien raccourci",
    tagline: "Une adresse trop courte pour être lisible.",
    situation:
      "Un message contient une adresse minuscule — `bit.ly/…`, `tinyurl/…`, ou un lien sans nom de domaine. Elle peut mener n'importe où.",
    redFlags: [
      {
        label: "On ne voit pas le domaine",
        why: "La destination réelle est masquée : c'est précisément l'intérêt du raccourcisseur.",
      },
      {
        label: "Le lien arrive sans raison",
        why: "Dans une facture, un message d'une banque, un lien court n'a rien à faire.",
      },
      {
        label: "Il mène à une page de saisie",
        why: "Un raccourci qui débouche sur un formulaire d'identifiants est le scénario le plus courant.",
      },
    ],
    reflex: [
      "Collez le lien dans SafeDM : il est vérifié sans être ouvert.",
      "Si le lien n'a rien à faire avec ce que vous attendiez, supprimez-le.",
      "Si l'adresse raccourcie vient d'un contact connu, demandez-lui par un autre canal.",
    ],
    actions: [
      { label: "Analyser ce lien", action: "analyze" },
      { label: "Signaler ce message", action: "report" },
    ],
    related: ["colis", "annonce"],
  },
  {
    id: "securite-factice",
    icon: "warning",
    title: "L'alerte de sécurité factice",
    tagline: "« Votre téléphone est infecté ! »",
    situation:
      "Une page surgit en plein écran : « Votre appareil est en danger », « 42 virus détectés », « appelez immédiatement le support technique ».",
    redFlags: [
      {
        label: "C'est le navigateur qui parle",
        why: "Un vrai système d'alerte ne s'affiche pas dans une page web qui s'ouvre toute seule.",
      },
      {
        label: "Un compte à rebours",
        why: "Le compte à rebours interdit de lire : c'est une technique de pression, pas une mesure de sécurité.",
      },
      {
        label: "Un numéro à appeler",
        why: "Le « support technique » qui rappelle le numéro du message, c'est l'arnaque elle-même.",
      },
    ],
    reflex: [
      "Fermez la page. Ne rappelez pas le numéro affiché.",
      "Si le doute persiste : déconnectez le Wi-Fi, ouvrez l'application officielle du navigateur et vérifiez ses données.",
      "Ne jamais « installer » un logiciel depuis une page qui s'ouvre seule.",
    ],
    actions: [{ label: "Analyser le lien", action: "analyze" }],
    related: ["phishing", "lien-court"],
  },
  {
    id: "annonce",
    icon: "users",
    title: "Le vendeur qui veut payer autrement",
    tagline: "Une marketplace qui propose un autre moyen de payer.",
    situation:
      "Sur une marketplace, un vendeur propose de payer par virement, par crypto, ou via un lien de paiement personnel — ou vous demande de payer des frais d'envoi à l'avance.",
    redFlags: [
      {
        label: "Il veut rompre la plateforme",
        why: "La plateforme permet de vérifier et de se rembourser. Hors plateforme, plus aucune protection.",
      },
      {
        label: "Des frais à avancer",
        why: "On ne paie jamais les frais de port pour le compte d'un vendeur.",
      },
      {
        label: "Une pression à l'achat",
        why: "« Il ne reste qu'un exemplaire », « n'attendez pas » : l'urgence détruit la vérification.",
      },
    ],
    reflex: [
      "Restez dans la plateforme, tant pour payer que pour communiquer.",
      "Ne réglez jamais de frais de transport à un vendeur.",
      "Méfiez-vous d'un prix trop bas, surtout si l'objet est rare.",
    ],
    actions: [{ label: "Analyser ce message", action: "analyze" }],
    related: ["otp", "lien-court"],
  },
];

/** Petit quiz de validation des reflexes. */
export const QUIZ = [
  {
    id: "q-code",
    question:
      "Un « support technique » vous demande le code reçu par SMS. Que faites-vous ?",
    choices: [
      {
        id: "a",
        label: "Je lui communique, il doit vérifier mon compte",
        correct: false,
        why: "Un code prouve que c'est vous. Le donner à quelqu'un d'autre lui permet d'agir comme vous.",
      },
      {
        id: "b",
        label: "Je ne le communique pas et je rappelle le numéro officiel",
        correct: true,
        why: "Exact. On rappelle par soi-même, jamais par le canal indiqué dans la demande.",
      },
      {
        id: "c",
        label: "Je lui donne seulement les derniers chiffres",
        correct: false,
        why: "Les derniers chiffres suffisent souvent à valider une transaction. Un code se donne en entier ou pas du tout.",
      },
    ],
  },
  {
    id: "q-urgence",
    question: "Votre banque menace de bloquer votre compte dans 2 heures. Vous faites :",
    choices: [
      {
        id: "a",
        label: "Je clique sur le lien pour vérifier",
        correct: false,
        why: "Le lien est le canal de l'arnaque. Le compte à rebours est la pression.",
      },
      {
        id: "b",
        label: "J'attends 24 heures pour voir si ça bouge",
        correct: false,
        why: "Attendre, c'est laisser l'escroc agir. La vérification doit passer par l'application officielle, tout de suite.",
      },
      {
        id: "c",
        label: "J'ouvre l'application de ma banque et je vérifie là",
        correct: true,
        why: "C'est la bonne conduite : on utilise le canal officiel, jamais celui du message.",
      },
    ],
  },
  {
    id: "q-lien",
    question: "Un lien raccourci arrive dans un SMS de livraison. Vous le collez dans SafeDM.",
    choices: [
      {
        id: "a",
        label: "Exactement : le lien est vérifié sans être ouvert",
        correct: true,
        why: "C'est l'usage principal de SafeDM : la vérification précède l'ouverture, et le texte reste sur le téléphone.",
      },
      {
        id: "b",
        label: "Non, il faut d'abord l'ouvrir pour savoir ce que c'est",
        correct: false,
        why: "L'ouverture est précisément ce qu'on cherche à éviter. L'analyse se fait avant.",
      },
      {
        id: "c",
        label: "Non, un lien raccourci est toujours malveillant",
        correct: false,
        why: "Un raccourci n'est pas mauvais en soi — il est simplement illisible. C'est le contexte qui décide.",
      },
    ],
  },
  {
    id: "q-apres-clic",
    question: "Vous avez cliqué et saisi votre mot de passe. La première chose à faire :",
    choices: [
      {
        id: "a",
        label: "Changer le mot de passe depuis le lien que j'ai ouvert",
        correct: false,
        why: "Ce lien est contrôlé par l'escroc. Le changement se fait depuis le site officiel, en tapant l'adresse vous-même.",
      },
      {
        id: "b",
        label: "Changer le mot de passe depuis le site officiel et prévenir ma banque",
        correct: true,
        why: "C'est la conduite correcte, et le signalement du message aide les autres.",
      },
      {
        id: "c",
        label: "Ne rien faire, mes identifiants sont chiffrés",
        correct: false,
        why: "Le chiffrement protège le transport, pas un mot de passe déjà envoyé au mauvais site.",
      },
    ],
  },
  {
    id: "q-signalement",
    question: "Un message est douteux, mais sans certitude. Vous le signalez ?",
    choices: [
      {
        id: "a",
        label: "Non, on ne signale que ce dont on est sûr",
        correct: false,
        why: "Un doute suffit : le signalement sert à protéger quelqu'un d'autre, et il est réversible.",
      },
      {
        id: "b",
        label: "Oui, un doute suffit à signaler",
        correct: true,
        why: "Exact. Signaler, c'est donner une chance à la communauté d'y regarder.",
      },
      {
        id: "c",
        label: "Seulement si la banque est concernée",
        correct: false,
        why: "Les arnaques ne se limitent pas aux banques : colis, marketplace, support technique.",
      },
    ],
  },
];

const SCENARIOS_BY_ID = SCENARIOS.reduce((acc, scenario) => {
  acc[scenario.id] = scenario;
  return acc;
}, {});

const REFLEXES_BY_ID = REFLEXES.reduce((acc, reflex) => {
  acc[reflex.id] = reflex;
  return acc;
}, {});

export function getScenario(id) {
  return SCENARIOS_BY_ID[id] || null;
}

export function getReflex(id) {
  return REFLEXES_BY_ID[id] || null;
}

/**
 * Astuce du jour.
 *
 * Elle tourne chaque jour pour que l'accueil reste vivant sans repudiante :
 * c'est le meme contenu de fond, mais l'utilisateur n'a pas le meme réflexe
 * sous les yeux tous les matins.
 */
export function getDailyTip(date = new Date()) {
  const dayIndex = Math.floor(
    date.getTime() / 86400000 - date.getTimezoneOffset() / 1440,
  );
  const index = ((dayIndex % SCENARIOS.length) + SCENARIOS.length) % SCENARIOS.length;
  return SCENARIOS[index];
}
