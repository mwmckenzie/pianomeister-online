/**
 * Well-known composers for guessing an upload's composer from its file name or MIDI text
 * (brief decision 79). `names` are words that name the composer and are dropped from a guessed
 * title ("Clair_de_Lune__Debussy" → "Clair de Lune"); `catalogues` are catalogue prefixes that
 * imply the composer but stay in the title ("BWV 772"). Matching ignores case and accents.
 */
export const KNOWN_COMPOSERS: readonly {
  readonly name: string
  readonly names: readonly string[]
  readonly catalogues?: readonly string[]
}[] = [
  { name: 'J. S. Bach', names: ['bach'], catalogues: ['bwv'] },
  { name: 'Ludwig van Beethoven', names: ['beethoven'], catalogues: ['woo'] },
  { name: 'Wolfgang Amadeus Mozart', names: ['mozart'], catalogues: ['kv'] },
  { name: 'Frédéric Chopin', names: ['chopin'] },
  { name: 'Claude Debussy', names: ['debussy'] },
  { name: 'Franz Liszt', names: ['liszt'] },
  { name: 'Franz Schubert', names: ['schubert'] },
  { name: 'Robert Schumann', names: ['schumann'] },
  { name: 'Johannes Brahms', names: ['brahms'] },
  { name: 'Joseph Haydn', names: ['haydn'], catalogues: ['hob'] },
  { name: 'George Frideric Handel', names: ['handel', 'haendel', 'händel'], catalogues: ['hwv'] },
  { name: 'Felix Mendelssohn', names: ['mendelssohn'] },
  { name: 'Pyotr Ilyich Tchaikovsky', names: ['tchaikovsky', 'tschaikowsky', 'chaikovsky'] },
  { name: 'Sergei Rachmaninoff', names: ['rachmaninoff', 'rachmaninov'] },
  { name: 'Erik Satie', names: ['satie'] },
  { name: 'Maurice Ravel', names: ['ravel'] },
  { name: 'Edvard Grieg', names: ['grieg'] },
  { name: 'Domenico Scarlatti', names: ['scarlatti'] },
  { name: 'Muzio Clementi', names: ['clementi'] },
  { name: 'Carl Czerny', names: ['czerny'] },
  { name: 'Friedrich Burgmüller', names: ['burgmuller', 'burgmueller'] },
  { name: 'Scott Joplin', names: ['joplin'] },
  { name: 'Antonio Vivaldi', names: ['vivaldi'] },
  { name: 'Johann Pachelbel', names: ['pachelbel'] },
  { name: 'Modest Mussorgsky', names: ['mussorgsky', 'moussorgsky'] },
  { name: 'Isaac Albéniz', names: ['albeniz'] },
  { name: 'Gabriel Fauré', names: ['faure'] },
  { name: 'Sergei Prokofiev', names: ['prokofiev'] },
  { name: 'Alexander Scriabin', names: ['scriabin', 'skrjabin'] },
  { name: 'Béla Bartók', names: ['bartok'] },
  { name: 'George Gershwin', names: ['gershwin'] },
  { name: 'Antonín Dvořák', names: ['dvorak'] },
]
