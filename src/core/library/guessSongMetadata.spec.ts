// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { MidiText } from '../song/MidiText'
import { readMidiText } from '../song/readMidiText'
import { buildSmf, ev } from '../testing/buildSmf'
import { guessSongMetadata } from './guessSongMetadata'

const NO_TEXT: MidiText = { sequenceName: '', texts: [], copyrights: [] }

const guess = (fileName: string, text: Partial<MidiText> = {}, composers: string[] = []) =>
  guessSongMetadata({ fileName, text: { ...NO_TEXT, ...text } }, composers)

describe('guessSongMetadata — from the file name', () => {
  it('tidies realistic file names and finds the composer in them', () => {
    expect(guess('Bach_Invention_No.8_bwv_779_TwoHands.mid')).toEqual({
      title: 'Invention No. 8 BWV 779',
      composer: 'J. S. Bach',
    })
    expect(guess('Beethoven_Sonate_No10_1st_Mvmt_TwoHands.mid')).toEqual({
      title: 'Sonate No. 10 1st Mvmt',
      composer: 'Ludwig van Beethoven',
    })
    expect(guess('Clair_de_Lune__Debussy_TwoHands.mid')).toEqual({
      title: 'Clair de Lune',
      composer: 'Claude Debussy',
    })
    // A catalogue prefix names the composer but stays in the title; "(c)closkey" goes.
    expect(guess('BWV772_(c)closkey.mid')).toEqual({ title: 'BWV 772', composer: 'J. S. Bach' })
  })

  it('handles dashes, FourHands, opus numbers and accents', () => {
    expect(guess('chopin-nocturne-op9-no2.midi')).toEqual({
      title: 'nocturne Op. 9 No. 2',
      composer: 'Frédéric Chopin',
    })
    expect(guess('Dvorak_Humoresque_FourHands.mid').composer).toBe('Antonín Dvořák')
    expect(guess('my  song__final.mid')).toEqual({ title: 'my song final', composer: '' })
  })

  it("prefers the library's spelling of a composer, matched by surname", () => {
    expect(guess('Bach_Minuet.mid', {}, ['J.S. Bach']).composer).toBe('J.S. Bach')
    expect(guess('BWV_846.mid', {}, ['Johann Sebastian Bach']).composer).toBe(
      'Johann Sebastian Bach',
    )
    // A parenthesised attribution isn't the surname.
    const petzold = 'Christian Petzold (attrib. J.S. Bach)'
    expect(guess('Minuet_in_G_Petzold.mid', {}, [petzold])).toEqual({
      title: 'Minuet in G',
      composer: petzold,
    })
  })

  it("keeps a title that is only the composer's name", () => {
    expect(guess('Satie.mid')).toEqual({ title: 'Satie', composer: 'Erik Satie' })
  })
})

describe('guessSongMetadata — from the MIDI text', () => {
  it('uses the sequence name unless it is generic', () => {
    expect(guess('x.mid', { sequenceName: 'Für Elise' }).title).toBe('Für Elise')
    for (const generic of ['Track 1', 'Piano', 'untitled', '', '  ', 'Acoustic Grand Piano']) {
      expect(guess('Gymnopedie_1.mid', { sequenceName: generic }).title).toBe('Gymnopedie 1')
    }
  })

  it('reads a stated composer from text events', () => {
    expect(guess('a.mid', { texts: ['Composer: Erik Satie'] }).composer).toBe('Erik Satie')
    expect(guess('a.mid', { texts: ['Composed by Jane Roe.'] }).composer).toBe('Jane Roe')
    // A known composer stated loosely gets the full name.
    expect(guess('a.mid', { texts: ['Invention 8 by J.S. Bach'] }).composer).toBe('J. S. Bach')
    // Whoever sequenced the file isn't the composer.
    expect(guess('a.mid', { texts: ['Sequenced by Jane Roe'] }).composer).toBe('')
  })

  it('falls back to the copyright holder after a name match', () => {
    const copyrights = ['Copyright © 1999 by Bernd Krüger. All rights reserved']
    expect(guess('my_piece.mid', { copyrights }).composer).toBe('Bernd Krüger')
    expect(guess('Clair_de_Lune__Debussy.mid', { copyrights }).composer).toBe('Claude Debussy')
    expect(guess('a.mid', { copyrights: ['(c) 2003-2005 Jane Roe'] }).composer).toBe('Jane Roe')
  })
})

describe('readMidiText', () => {
  it('reads the first track name, text events and copyright (Latin-1 or UTF-8)', () => {
    const bytes = buildSmf({
      format: 1,
      ppq: 480,
      tracks: [
        [
          ev.trackName(0, 'Invention 8'),
          ev.meta(0, 2, '', [0xa9, 0x20, 0x4a, 0x61, 0x6e, 0x65]), // "© Jane" in Latin-1
          ev.meta(0, 1, 'Composer: J.S. Bach'),
        ],
        [
          ev.trackName(0, 'Piano'),
          ev.meta(0, 1, '', [0x46, 0xc3, 0xbc, 0x72]),
          ev.noteOn(0, 0, 60),
        ],
      ],
    })
    expect(readMidiText(bytes)).toEqual({
      sequenceName: 'Invention 8',
      texts: ['Composer: J.S. Bach', 'Für'],
      copyrights: ['© Jane'],
    })
  })

  it('reads nothing from a file without text', () => {
    const bytes = buildSmf({ format: 0, ppq: 480, tracks: [[ev.noteOn(0, 0, 60)]] })
    expect(readMidiText(bytes)).toEqual(NO_TEXT)
  })
})
