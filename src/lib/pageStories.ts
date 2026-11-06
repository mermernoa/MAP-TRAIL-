/**
 * Textes rédigés pour les pages Trails les plus cherchées (régions, départements, grandes
 * villes) : terrain, massifs, saison, conseils. Ton Take Ton Trail : tutoiement, vocabulaire
 * de coureur, et rien d'inventé (les chiffres de courses restent calculés à part).
 * Clé : le slug de la page (/trails/<slug>).
 */
export interface PageStory {
  title: string;
  paragraphs: string[];
}

export const PAGE_STORIES: Record<string, PageStory> = {
  // ——— Régions ———
  'auvergne-rhone-alpes': {
    title: 'Le terrain de jeu XXL',
    paragraphs: [
      'Des volcans d’Auvergne aux 4 808 m du Mont-Blanc, c’est la région qui a le plus de D+ au kilomètre carré. Tu peux enchaîner une boucle dans la chaîne des Puys, un trail dans le Vercors et une course d’altitude en Haute-Savoie sans jamais quitter la région.',
      'L’été, c’est la saison des grands ultras et des courses au-dessus de 2 000 m. L’hiver, place aux trails blancs en station et aux nocturnes autour de Lyon, de Grenoble ou de Clermont. Bref : il y a toujours un dossard à accrocher quelque part.',
    ],
  },
  occitanie: {
    title: 'Des Pyrénées à la Méditerranée',
    paragraphs: [
      'L’Occitanie, c’est le grand écart : les cols et les cirques des Pyrénées d’un côté, la garrigue, les Causses et les Cévennes de l’autre, avec la Méditerranée en bonus. Les sentiers y sont souvent caillouteux, secs et techniques : soigne tes chevilles.',
      'Au printemps et à l’automne, la région est idéale pour courir sans cuire. L’été, on monte en altitude dans les Pyrénées ; l’hiver, les trails de la côte et de l’arrière-pays montpelliérain prennent le relais.',
    ],
  },
  'provence-alpes-cote-d-azur': {
    title: 'Calanques, Verdon et sommets',
    paragraphs: [
      'En Provence-Alpes-Côte d’Azur, tu peux courir les pieds dans le calcaire des Calanques le matin et viser un sommet du Mercantour le week-end suivant. Les Écrins, le Queyras et l’Ubaye pour l’altitude, la Sainte-Victoire, la Sainte-Baume et l’Esterel pour la Provence.',
      'Le soleil est un allié l’hiver et un piège l’été : pars tôt, prends de l’eau, beaucoup d’eau. Et garde des jambes pour les descentes, raides et pleines de cailloux roulants.',
    ],
  },
  bretagne: {
    title: 'Le trail iodé',
    paragraphs: [
      'Pas de grands cols en Bretagne, mais des relances à n’en plus finir. Le sentier des douaniers (GR34) longe la côte et enchaîne les petites montées sèches, les marches taillées dans la roche et les vues sur l’océan. Ça ne grimpe jamais longtemps, mais ça ne s’arrête jamais vraiment.',
      'Dans les terres, les monts d’Arrée et la forêt de Brocéliande offrent un trail plus sauvage. Côté météo, prévois toujours une veste : le vent et le crachin font partie du parcours.',
    ],
  },

  // ——— Départements ———
  'haute-savoie': {
    title: 'Le paradis du trail alpin',
    paragraphs: [
      'Chamonix et le massif du Mont-Blanc, les Aravis, le Chablais, les Bornes et le lac d’Annecy : la Haute-Savoie, c’est la Mecque du trail en France. Ici, les courses se comptent en milliers de mètres de D+ et les sentiers montent souvent au-dessus de 2 000 m.',
      'La grande saison va de juin à septembre, quand les cols sont déneigés. Le reste de l’année, les stations organisent des trails blancs et des nocturnes à la frontale. Bâtons conseillés, cuisses en béton recommandées.',
    ],
  },
  savoie: {
    title: 'Vanoise, Beaufortain et compagnie',
    paragraphs: [
      'La Savoie, c’est la Vanoise, le Beaufortain, la Maurienne, la Tarentaise et les Bauges, avec le lac du Bourget en contrebas. Des montées longues et régulières, des alpages à perte de vue et des descentes qui piquent les quadriceps.',
      'L’été, les courses passent par des cols mythiques du cyclisme et des refuges d’altitude. L’hiver, les stations sortent les trails blancs : crampons légers et frontale au programme.',
    ],
  },
  isere: {
    title: 'Trois massifs autour de Grenoble',
    paragraphs: [
      'L’Isère, c’est le Vercors, la Chartreuse et Belledonne, avec l’Oisans et les Écrins en prime. Des falaises calcaires, des forêts profondes et des crêtes à plus de 2 000 m, souvent accessibles en partant directement de la ville.',
      'Le calendrier est bien rempli toute l’année : trails de moyenne montagne au printemps, grandes courses d’altitude l’été, nocturnes et trails blancs l’hiver sur les plateaux du Vercors et de la Chartreuse.',
    ],
  },
  'hautes-alpes': {
    title: 'Altitude et grand air',
    paragraphs: [
      'Les Écrins, le Queyras, le Dévoluy, le Champsaur : les Hautes-Alpes, c’est la haute montagne version sauvage, avec un ciel souvent bleu et un air qui se raréfie vite. Briançon est la plus haute ville de France, ça donne le ton.',
      'La belle saison est courte et intense : de juin à septembre, les courses grimpent haut et loin. Prévois de quoi te couvrir, même en plein été, les orages de fin de journée ne préviennent pas.',
    ],
  },
  'alpes-maritimes': {
    title: 'De la mer aux sommets',
    paragraphs: [
      'Dans les Alpes-Maritimes, tu peux partir du bord de la Méditerranée et finir à plus de 2 500 m dans le Mercantour. Entre les deux : l’arrière-pays niçois, ses villages perchés et ses sentiers muletiers en pierre.',
      'L’hiver, c’est la bonne période pour courir sur les hauteurs de la côte au soleil. L’été, on file vers la Vésubie, la Tinée et le Mercantour, plus frais et plus sauvages.',
    ],
  },
  'pyrenees-atlantiques': {
    title: 'Pays basque et vallées béarnaises',
    paragraphs: [
      'D’un côté, le Pays basque, ses collines vertes, ses brebis et la Rhune qui domine l’océan. De l’autre, le Béarn et la vallée d’Ossau, où les sentiers deviennent vite de la vraie montagne, au pied du pic du Midi d’Ossau.',
      'Le climat est océanique : de la pluie possible toute l’année, des sentiers parfois gras, mais une herbe d’un vert incroyable. Chaussures avec du grip obligatoires.',
    ],
  },
  'hautes-pyrenees': {
    title: 'Cirques et grands cols',
    paragraphs: [
      'Gavarnie, le Néouvielle, le pic du Midi de Bigorre, les vallées de Cauterets et de Luz : les Hautes-Pyrénées, c’est le cœur de la chaîne. Les courses y enchaînent les cols du Tour de France et les lacs d’altitude.',
      'La saison d’altitude va de juin à octobre. En dehors, les stations et les vallées accueillent des trails plus courts, parfois sur neige.',
    ],
  },
  'pyrenees-orientales': {
    title: 'Le Canigou et la Catalogne',
    paragraphs: [
      'Ici, tout tourne autour du Canigou, la montagne sacrée des Catalans, qui monte à 2 784 m à quelques dizaines de kilomètres de la plage. Ajoute la Cerdagne, le Capcir et les Albères, et tu as tous les terrains, du sentier côtier au pierrier d’altitude.',
      'Le soleil est généreux presque toute l’année : idéal pour courir l’hiver sur les contreforts, à condition de penser à l’eau et à la crème.',
    ],
  },
  'puy-de-dome': {
    title: 'Courir sur les volcans',
    paragraphs: [
      'La chaîne des Puys, inscrite au patrimoine mondial de l’Unesco, offre un terrain unique : des volcans à gravir les uns après les autres, des sentiers de pouzzolane et des panoramas à 360°. Au sud, le massif du Sancy culmine à 1 886 m, le point le plus haut du Massif central.',
      'Les montées sont courtes mais raides, et le vent peut souffler fort sur les crêtes. L’hiver, la neige transforme le Sancy en terrain de trail blanc.',
    ],
  },
  var: {
    title: 'Garrigue, Maures et Esterel',
    paragraphs: [
      'Le massif des Maures, l’Esterel et ses roches rouges, la Sainte-Baume, le mont Faron au-dessus de Toulon : le Var offre des sentiers secs, techniques et parfumés au thym, avec souvent la mer en ligne de mire.',
      'L’automne, l’hiver et le printemps sont parfaits pour y courir. L’été, la chaleur et les risques d’incendie peuvent fermer certains massifs : renseigne-toi avant de partir.',
    ],
  },
  drome: {
    title: 'Du Vercors à la Provence',
    paragraphs: [
      'La Drôme fait la transition entre les Alpes et la Provence : le sud du Vercors et le Diois au nord, les Baronnies et la Drôme provençale au sud. Des falaises, des crêtes calcaires, de la lavande et des villages perchés.',
      'Les courses y sont souvent techniques et ensoleillées, avec un dénivelé qui surprend. Le printemps et l’automne sont les meilleures saisons pour en profiter.',
    ],
  },
  ardeche: {
    title: 'Gorges, châtaigniers et volcans',
    paragraphs: [
      'L’Ardèche, ce sont ses gorges spectaculaires au sud et ses montagnes au nord, autour du mont Gerbier-de-Jonc où naît la Loire. Entre les deux : des châtaigneraies, des sentiers en terrasses et des vieux villages de pierre.',
      'Les courses mélangent sentiers roulants et passages bien techniques le long des rivières. L’automne y est superbe, quand les châtaigniers prennent leurs couleurs.',
    ],
  },
  finistere: {
    title: 'Le bout du monde en baskets',
    paragraphs: [
      'Le Finistère, c’est la presqu’île de Crozon, la pointe du Raz, les abers et le GR34 qui épouse la côte. Au centre, les monts d’Arrée offrent des landes sauvages et le point culminant de la Bretagne.',
      'Le terrain n’est pas très haut, mais il ne laisse aucun répit : des relances, du vent, des marches et des descentes vers les criques. Une veste coupe-vent n’est jamais de trop.',
    ],
  },
  'la-reunion': {
    title: 'L’île intense',
    paragraphs: [
      'La Réunion, c’est le trail version extrême : le Piton des Neiges à 3 070 m, le Piton de la Fournaise, et les cirques de Mafate, Cilaos et Salazie. Des marches taillées dans la roche, des sentiers humides et un dénivelé qui ne pardonne pas.',
      'C’est aussi l’île du Grand Raid et de sa célèbre Diagonale des Fous. Ici, le trail est une culture : il y a des courses toute l’année, de la côte jusqu’aux remparts.',
    ],
  },

  // ——— Grandes villes ———
  'pres-de-paris': {
    title: 'Du trail aux portes de Paris',
    paragraphs: [
      'Pas de montagnes en Île-de-France, mais des forêts magnifiques à moins d’une heure de Paris : Fontainebleau et ses rochers, Rambouillet, la vallée de Chevreuse, Saint-Germain-en-Laye. De quoi enchaîner les petites bosses et les relances.',
      'Le calendrier francilien est dense toute l’année, avec beaucoup de trails courts et de nocturnes l’hiver. Parfait pour préparer une grosse course en montagne sans quitter la région.',
    ],
  },
  'pres-de-lyon': {
    title: 'Lyon, ville de trail',
    paragraphs: [
      'Autour de Lyon, tu as les monts d’Or, les monts du Lyonnais, le Beaujolais et le Pilat, et même les escaliers des pentes de la Croix-Rousse et de Fourvière pour t’entraîner en ville.',
      'Lyon, c’est aussi la ville d’arrivée de la SaintéLyon, la grande traversée nocturne de décembre depuis Saint-Étienne. Le reste de l’année, les trails des monts d’Or et du Beaujolais remplissent le calendrier.',
    ],
  },
  'pres-de-marseille': {
    title: 'Calanques et collines de Pagnol',
    paragraphs: [
      'Autour de Marseille, c’est le parc national des Calanques, le massif de la Sainte-Baume, le Garlaban cher à Pagnol et la Sainte-Victoire du côté d’Aix. Du calcaire blanc, de la garrigue et la Méditerranée presque toujours en vue.',
      'Les sentiers sont secs, cassants et techniques : idéal pour travailler tes appuis. La meilleure saison va de l’automne au printemps ; l’été, certains massifs ferment à cause du risque d’incendie.',
    ],
  },
  'pres-de-grenoble': {
    title: 'La capitale des Alpes',
    paragraphs: [
      'À Grenoble, les montagnes sont au bout de la rue : le Vercors, la Chartreuse et Belledonne entourent la ville, et la Bastille se monte en footing avant le travail. Peu de villes en France offrent autant de D+ si près du centre.',
      'Résultat : un calendrier de trail riche toute l’année, des courses de moyenne montagne aux trails d’altitude, sans oublier les nocturnes et les trails blancs l’hiver.',
    ],
  },
  'pres-d-annecy': {
    title: 'Entre lac et montagnes',
    paragraphs: [
      'Autour d’Annecy, le lac est entouré de sommets : le Semnoz, la Tournette, le Parmelan, et les Aravis un peu plus loin. Les sentiers grimpent fort dès le bord de l’eau, avec des vues à couper le souffle (et les jambes).',
      'Annecy est une vraie ville de trail, avec des courses toute l’année. Le printemps et l’automne y sont parfaits, l’été pour l’altitude, l’hiver pour les nocturnes.',
    ],
  },
  'pres-de-toulouse': {
    title: 'Coteaux et Pyrénées en ligne de mire',
    paragraphs: [
      'Autour de Toulouse, le terrain est fait de coteaux, de bois et de vallons : les côtes du Lauragais, du Gers et du Tarn offrent des trails roulants avec de belles relances. Par temps clair, la chaîne des Pyrénées se dessine à l’horizon.',
      'Le calendrier local est riche en trails courts et en nocturnes, parfaits pour travailler la vitesse avant de monter dans les Pyrénées le week-end suivant.',
    ],
  },
  'pres-de-nice': {
    title: 'Courir au-dessus de la Baie des Anges',
    paragraphs: [
      'Depuis Nice, les sentiers montent vite vers les collines et l’arrière-pays : le mont Boron, les villages perchés, les vallées de la Vésubie et du Paillon, puis le Mercantour pour les plus ambitieux.',
      'L’hiver, le soleil de la Côte d’Azur rend les courses très agréables. L’été, on cherche la fraîcheur en altitude, au-dessus de 1 500 m.',
    ],
  },
  'pres-de-bordeaux': {
    title: 'Vignes, forêts et bords de Garonne',
    paragraphs: [
      'Autour de Bordeaux, le trail se court entre les vignobles de l’Entre-deux-Mers, les coteaux de la Garonne et les grandes forêts de pins. Peu de dénivelé, mais des parcours rapides et des relances à n’en plus finir.',
      'Certaines courses traversent des domaines viticoles : de quoi transformer le ravito d’arrivée en moment mémorable (avec modération, évidemment).',
    ],
  },
  'pres-de-montpellier': {
    title: 'Pic Saint-Loup et garrigue',
    paragraphs: [
      'Autour de Montpellier, le pic Saint-Loup et l’Hortus dominent la garrigue, avec les Cévennes un peu plus au nord. Des sentiers caillouteux, des montées sèches et des odeurs de thym et de romarin.',
      'L’hiver et le printemps sont les meilleures saisons : il fait doux, la lumière est belle, et le calendrier régional est bien rempli.',
    ],
  },
  'pres-de-clermont-ferrand': {
    title: 'Les volcans en voisins',
    paragraphs: [
      'À Clermont-Ferrand, le puy de Dôme est visible depuis la ville, et toute la chaîne des Puys est à quelques minutes. Des volcans à grimper, des cratères à contourner et des sentiers de pouzzolane qui roulent sous les pieds.',
      'Plus au sud, le Sancy offre de vraies montées de moyenne montagne. L’hiver, la neige change complètement le décor.',
    ],
  },
  'pres-de-saint-denis-la-reunion': {
    title: 'Le nord de l’île intense',
    paragraphs: [
      'Depuis Saint-Denis, les sentiers grimpent directement vers les hauts : la Roche Écrite, la plaine des Chicots, et les remparts qui plongent sur Mafate et Salazie. Peu de distance, mais beaucoup de marches et de dénivelé.',
      'Le trail fait partie de la culture réunionnaise : il y a des courses toute l’année, de la côte jusqu’aux sommets. Pars tôt, le soleil tape vite.',
    ],
  },
};
