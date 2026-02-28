# Guide de Narration Text-to-Speech

*Ce guide est aussi disponible en :
[English](TTS-GUIDE.md) |
Francais |
[Espanol](TTS-GUIDE-es.md) |
[Deutsch](TTS-GUIDE-de.md) |
[日本語](TTS-GUIDE-ja.md) |
[Русский](TTS-GUIDE-ru.md) |
[中文](TTS-GUIDE-zh.md)*

## Pourquoi le TTS transforme votre facon d'etudier les echecs

Quand vous analysez une partie annotee, vos yeux font le travail de deux. Vous essayez de suivre les pieces sur l'echiquier *et* de lire les commentaires en meme temps. Votre regard fait des allers-retours entre l'echiquier et le panneau d'annotations, et a chaque fois, vous perdez la position l'espace d'un instant. Il faut retrouver les pieces, retracer les lignes, reconstruire l'image mentale.

Le text-to-speech resout ce probleme completement.

Avec le TTS active, vous avancez dans la partie et les annotations vous sont *lues a voix haute*. Vos yeux restent sur l'echiquier. Vous regardez le cavalier arriver en f3 pendant qu'une voix vous explique pourquoi c'est un bon coup de developpement. Vous voyez la structure de pions evoluer pendant que le commentaire detaille l'idee strategique. L'echiquier et les mots arrivent ensemble, exactement comme un entraineur assis en face de vous vous enseignerait.

C'est particulierement efficace pour :

- **L'etude des ouvertures** — entendre les idees derriere chaque coup en regardant la position se developper
- **La revue de parties** — parcourir vos parties annotees et assimiler les lecons naturellement
- **La pratique des finales** — garder votre attention sur les cases critiques pendant que les commentaires vous guident
- **L'immersion linguistique** — etudiez les echecs en francais, allemand, espagnol, russe, japonais ou chinois avec tous les termes traduits automatiquement. Entendez "Cavalier f3, echec" au lieu de "Knight f3, check." Apprenez le jeu dans la langue dans laquelle vous pensez.
- **L'accessibilite** — pour les joueurs qui trouvent plus facile d'ecouter que de lire, ou qui veulent etudier loin de leur bureau

Une fois que vous aurez essaye, revenir aux annotations silencieuses vous donnera l'impression de regarder un film sans le son.

## Choisir un fournisseur

Cette version propose deux fournisseurs TTS — Google Cloud et ElevenLabs. Si la communaute souhaite un autre fournisseur, faites-le nous savoir et nous pourrons l'ajouter. Vous n'avez besoin que d'un seul fournisseur pour commencer — choisissez celui qui vous convient le mieux.

|                        | Google Cloud                  | ElevenLabs                    |
|------------------------|-------------------------------|-------------------------------|
| **Offre gratuite**     | 1 000 000 car./mois           | 10 000 car./mois              |
| **Qualite vocale**     | Tres bonne (WaveNet)          | Excellente (voix IA premium)  |
| **Choix de voix**      | Homme ou Femme par langue     | Des dizaines de voix uniques  |
| **Forfaits payants**   | Paiement a l'usage (centimes) | A partir de 5 $/mois          |
| **Ideal pour**         | La plupart des utilisateurs   | Les passionnes de qualite vocale |
| **Difficulte de config.** | Moderee (Cloud Console)    | Facile (inscription simple)   |

**Notre recommandation :** Commencez par **Google Cloud**. L'offre gratuite vous donne un million de caracteres par mois — soit des centaines de parties entierement annotees, gratuitement. Les voix WaveNet sonnent tres bien. Si par la suite vous souhaitez une narration plus riche, plus expressive et avec plus de personnalite, ElevenLabs est la pour vous.

## Configurer Google Cloud TTS

Ce guide pas a pas prend environ 5 minutes. Vous aurez besoin d'un compte Google (celui que vous utilisez pour Gmail ou YouTube convient parfaitement).

### Etape 1 : Se connecter a Google Cloud Console

1. Ouvrez votre navigateur et allez sur **[console.cloud.google.com](https://console.cloud.google.com/)**
2. Connectez-vous avec votre compte Google
3. Si c'est votre premiere visite, Google vous demandera d'accepter les conditions d'utilisation. Cochez la case et cliquez sur **Agree and Continue**

Vous devriez maintenant voir le tableau de bord de Google Cloud Console. Il a l'air charge — pas d'inquietude, nous n'avons besoin que de deux choses ici.

### Etape 2 : Configurer la facturation

Google exige un compte de facturation meme pour l'offre gratuite. **Vous ne serez pas facture** sauf si vous depassez 1 million de caracteres par mois (ce qui est tres difficile a atteindre avec des annotations d'echecs). Google vous previent bien avant que cela n'arrive.

1. Dans la barre de recherche en haut, tapez **"Billing"** et cliquez sur **Billing** dans le menu deroulant
2. Cliquez sur **Link a billing account** (ou **Create account** si vous n'en avez pas encore)
3. Suivez les instructions pour ajouter une carte de credit ou de debit
4. Une fois termine, vous verrez une coche verte a cote de votre compte de facturation

> **Remarque :** Si vous avez deja configure la facturation Google Cloud pour un autre projet, vous pouvez passer cette etape. Votre compte de facturation existant fonctionne tres bien.

### Etape 3 : Activer le API Text-to-Speech

Cela indique a Google quel service vous souhaitez utiliser.

1. Dans la barre de recherche en haut, tapez **"Text-to-Speech"**
2. Dans les resultats du menu deroulant, cliquez sur **Cloud Text-to-Speech API** (il a une icone bleue API)
3. Vous arrivez sur la page de details de l'API. Cliquez sur le gros bouton bleu **Enable**
4. Attendez quelques secondes. Quand le bouton se transforme en **Manage**, l'API est activee

### Etape 4 : Creer une API key

L'API key est ce qu'En Croissant utilise pour communiquer avec les serveurs de Google.

1. Dans la barre de recherche en haut, tapez **"Credentials"** et cliquez sur **Credentials** sous "APIs & Services"
2. En haut de la page, cliquez sur **+ Create Credentials**
3. Dans le menu deroulant, selectionnez **API key**
4. Une boite de dialogue apparait avec votre nouvelle cle. Elle ressemble a ceci : `AIzaSyC...about 35 characters...`
5. **Cliquez sur l'icone de copie** a cote de la cle pour la copier dans votre presse-papiers
6. Cliquez sur **Close**

> **Recommande : Restreignez votre cle.** Apres avoir cree la cle, vous la verrez dans la liste sur la page Credentials. Cliquez sur le nom de la cle pour ouvrir ses parametres. Sous **API restrictions**, selectionnez **Restrict key**, puis choisissez **Cloud Text-to-Speech API** dans le menu deroulant et cliquez sur **Save**. Ainsi, meme si quelqu'un obtient votre cle, il ne pourra l'utiliser que pour le TTS — rien d'autre.

### Etape 5 : Configurer En Croissant

Vous y etes presque !

1. Ouvrez En Croissant et allez dans **Settings** (icone d'engrenage) > onglet **Sound**
2. Faites defiler jusqu'a la section TTS
3. Reglez **TTS Provider** sur **Google Cloud**
4. Cliquez dans le champ **Google Cloud API Key** et collez votre cle (Ctrl+V)
5. Mettez **Text-to-Speech** sur **On**
6. Cliquez sur le bouton **Test** a cote du selecteur de voix

Vous devriez entendre un coup d'echecs prononce a voix haute. Si c'est le cas — felicitations, tout est configure !

> **Depannage :** Si le test est silencieux, verifiez que (1) vous avez colle la cle API complete, (2) le API Text-to-Speech est active (Etape 3), et (3) la facturation est liee (Etape 2). Le probleme le plus courant est d'oublier d'activer l'API.

## Configurer ElevenLabs

ElevenLabs est plus simple a configurer mais dispose d'une offre gratuite plus restreinte (10 000 caracteres/mois — assez pour essayer avec quelques parties).

### Etape 1 : Creer un compte

1. Ouvrez votre navigateur et allez sur **[elevenlabs.io](https://elevenlabs.io/)**
2. Cliquez sur **Sign Up** en haut a droite
3. Vous pouvez vous inscrire avec Google, GitHub ou par email — choisissez ce qui est le plus simple pour vous
4. Apres l'inscription, vous arrivez sur le tableau de bord ElevenLabs

### Etape 2 : Obtenir votre API key

1. Dans le coin inferieur gauche du tableau de bord, cliquez sur votre **icone de profil** (ou votre nom)
2. Cliquez sur **Profile + API key**
3. Vous verrez une section API key. Cliquez sur **Reveal** pour afficher votre cle, ou **Generate** si vous n'en avez pas encore
4. La cle ressemble a ceci : `sk_...about 30 characters...`
5. **Cliquez sur l'icone de copie** pour la copier dans votre presse-papiers

### Etape 3 : Configurer En Croissant

1. Ouvrez En Croissant et allez dans **Settings** (icone d'engrenage) > onglet **Sound**
2. Faites defiler jusqu'a la section TTS
3. Reglez **TTS Provider** sur **ElevenLabs**
4. Cliquez dans le champ **ElevenLabs API Key** et collez votre cle (Ctrl+V)
5. Le menu deroulant **TTS Voice** se remplira avec vos voix disponibles. **Adam** est un excellent choix par defaut — clair, naturel, et parfaitement adapte aux commentaires d'echecs
6. Mettez **Text-to-Speech** sur **On**
7. Cliquez sur le bouton **Test** a cote du selecteur de voix

Vous devriez entendre un coup d'echecs prononce a voix haute.

> **A propos de l'offre gratuite :** ElevenLabs vous donne 10 000 caracteres/mois avec le forfait gratuit. Une partie annotee typique utilise entre 2 000 et 4 000 caracteres, ce qui vous permet d'analyser 2 a 5 parties par mois gratuitement. Si vous trouvez le TTS utile, le forfait Starter a 5 $/mois (30 000 caracteres) est une excellente option. Le forfait Pro (22 $/mois, 100 000 caracteres) couvre une utilisation intensive.

## Reference des parametres

Tous les parametres TTS se trouvent dans **Settings > Sound** :

| Parametre                | Fonction                                                                       |
|--------------------------|--------------------------------------------------------------------------------|
| **Text-to-Speech**       | Interrupteur principal pour toutes les fonctionnalites TTS                      |
| **Auto-Narrate on Move** | Lit automatiquement les annotations quand vous parcourez les coups avec les fleches |
| **TTS Provider**         | Basculer entre ElevenLabs et Google Cloud                                       |
| **ElevenLabs API Key**   | Votre API key ElevenLabs (necessaire uniquement avec ElevenLabs)                |
| **Google Cloud API Key** | Votre API key Google Cloud (necessaire uniquement avec Google)                  |
| **TTS Voice**            | ElevenLabs : choisissez parmi vos voix. Google : choisissez Homme ou Femme     |
| **TTS Language**         | Langue de narration — tous les termes d'echecs sont traduits automatiquement    |
| **TTS Volume**           | Volume de la narration                                                          |
| **TTS Speed**            | Vitesse de lecture (0.5x a 2x) — s'ajuste instantanement sans regenerer l'audio |
| **TTS Audio Cache**      | Vider le cache audio pour forcer la regeneration (utile apres modification des annotations) |

## Langues prises en charge

La narration TTS prend actuellement en charge sept langues avec un vocabulaire echiqueen entierement traduit :

| Langue             | Exemple echiqueen                                   |
|--------------------|-----------------------------------------------------|
| **English**        | Knight f3, check. A strong developing move.         |
| **Francais**       | Cavalier f3, echec. Un coup de developpement fort.  |
| **Espanol**        | Caballo f3, jaque. Un fuerte movimiento.            |
| **Deutsch**        | Springer f3, Schach. Ein starker Entwicklungszug.   |
| **日本語**          | ナイト f3、チェック。強い展開の手。                      |
| **Русский**        | Конь f3, шах. Сильный развивающий ход.              |
| **中文**            | 马 f3，将军。一步控制中心的强力出子。                    |

Chaque terme d'echecs — noms de pieces, "echec", "echec et mat", "roque", "prend", annotations de qualite comme "Coup brillant" et "Gaffe" — est prononce dans la langue selectionnee. Les commentaires de vos fichiers PGN sont lus tels quels, donc annotez vos parties dans la langue que vous souhaitez entendre.

## Conseils pour une experience optimale

- **Utilisez Auto-Narrate.** Activez "Auto-Narrate on Move" et utilisez simplement les touches fleches pour parcourir les parties. Les commentaires arrivent naturellement au fil des coups, comme si un entraineur etait a vos cotes.

- **Annotez vos propres parties.** Le TTS brille vraiment quand vous ecoutez les commentaires sur *vos* parties. Annotez vos parties, puis parcourez-les avec la narration. Entendre "Prendre le pion est tentant, mais toute votre aile roi est encore endormie" en regardant la position frappe autrement que de le lire.

- **Essayez differentes vitesses.** Certains joueurs preferent 1x pour une etude minutieuse, d'autres preferent 1.3x pour une revue plus rapide. Le curseur de vitesse ajuste la lecture en temps reel sans consommer de caracteres API supplementaires — l'audio est genere une seule fois, puis lu plus rapidement.

- **Utilisez l'icone de haut-parleur.** Chaque commentaire dans la liste des coups possede une petite icone de haut-parleur. Cliquez dessus pour ecouter cette annotation specifique sans avoir a parcourir toute la partie.

- **Changez de langue pour apprendre le vocabulaire echiqueen.** Si vous etudiez les echecs dans une seconde langue, reglez la langue TTS en consequence. Vous apprendrez naturellement des termes comme "Cavalier" (Knight), "echec" (check) et "mat" (checkmate) simplement en ecoutant.

## A propos de cette fonctionnalite

En Croissant est un outil d'etude d'echecs open-source cree par [Francisco Salgueiro](https://github.com/franciscoBSalgueiro). Francisco a construit quelque chose de vraiment special — une plateforme gratuite, puissante et communautaire pour etudier les echecs — et l'a publiee sous licence GPL-3.0 pour que chacun puisse l'utiliser, l'ameliorer et la partager. Cette fonctionnalite TTS existe grace a cette generosite. Nous sommes reconnaissants pour les fondations qu'il a posees, et nous sommes fiers d'y contribuer en retour.

Le plugin TTS a ete developpe par Darrell chez [Red Shed](mailto:darrell@redshed.ai), avec l'aide de [Claude Code](https://claude.ai/claude-code). Support multilingue, integration double fournisseur, vocabulaire echiqueen traduit dans sept langues — construit a partir des sources, teste a la main, et contribue avec soin.

C'est toute la beaute de l'open source. Quelqu'un construit quelque chose de formidable. Quelqu'un d'autre y ajoute sa contribution. Tout le monde en profite.

## Nous contacter

Nous sommes enthousiastes a propos de cette fonctionnalite et nous aimerions beaucoup savoir comment elle fonctionne pour vous. Commentaires, suggestions et retours sont toujours les bienvenus.

- **Vous voulez une langue que nous ne proposons pas encore ?** Dites-le nous — nous pouvons ajouter de nouvelles langues rapidement.
- **Vous avez trouve un bug ?** Signalez-le et nous le corrigerons vite.
- **Vous avez une idee pour un autre fournisseur TTS ?** Nous serons ravis de l'ajouter.
- **Vous voulez simplement nous dire que ca marche ?** Ca nous fait plaisir aussi.

Ouvrez une issue ici sur GitHub, ou contactez-nous directement a **[darrell@redshed.ai](mailto:darrell@redshed.ai)**.
