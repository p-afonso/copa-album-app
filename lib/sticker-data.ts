export type StickerDef = {
  id: string
  section: string
  countryCode: string
  countryName: string
  number: string
  position: number
}

const GROUPS: { group: string; teams: { code: string; name: string }[] }[] = [
  {
    group: 'A',
    teams: [
      { code: 'MEX', name: 'México' },
      { code: 'RSA', name: 'África do Sul' },
      { code: 'KOR', name: 'Coréia do Sul' },
      { code: 'CZE', name: 'Rep. Tcheca' },
    ],
  },
  {
    group: 'B',
    teams: [
      { code: 'CAN', name: 'Canadá' },
      { code: 'BIH', name: 'Bósnia' },
      { code: 'QAT', name: 'Catar' },
      { code: 'SUI', name: 'Suíça' },
    ],
  },
  {
    group: 'C',
    teams: [
      { code: 'BRA', name: 'Brasil' },
      { code: 'MAR', name: 'Marrocos' },
      { code: 'HAI', name: 'Haiti' },
      { code: 'SCO', name: 'Escócia' },
    ],
  },
  {
    group: 'D',
    teams: [
      { code: 'USA', name: 'Estados Unidos' },
      { code: 'PAR', name: 'Paraguai' },
      { code: 'AUS', name: 'Austrália' },
      { code: 'TUR', name: 'Turquia' },
    ],
  },
  {
    group: 'E',
    teams: [
      { code: 'GER', name: 'Alemanha' },
      { code: 'CUW', name: 'Curaçao' },
      { code: 'CIV', name: 'Costa do Marfim' },
      { code: 'ECU', name: 'Equador' },
    ],
  },
  {
    group: 'F',
    teams: [
      { code: 'NED', name: 'Holanda' },
      { code: 'JPN', name: 'Japão' },
      { code: 'SWE', name: 'Suécia' },
      { code: 'TUN', name: 'Tunísia' },
    ],
  },
  {
    group: 'G',
    teams: [
      { code: 'BEL', name: 'Bélgica' },
      { code: 'EGY', name: 'Egito' },
      { code: 'IRN', name: 'Irã' },
      { code: 'NZL', name: 'Nova Zelândia' },
    ],
  },
  {
    group: 'H',
    teams: [
      { code: 'ESP', name: 'Espanha' },
      { code: 'CPV', name: 'Cabo Verde' },
      { code: 'KSA', name: 'Arábia Saudita' },
      { code: 'URU', name: 'Uruguai' },
    ],
  },
  {
    group: 'I',
    teams: [
      { code: 'FRA', name: 'França' },
      { code: 'SEN', name: 'Senegal' },
      { code: 'IRQ', name: 'Iraque' },
      { code: 'NOR', name: 'Noruega' },
    ],
  },
  {
    group: 'J',
    teams: [
      { code: 'ARG', name: 'Argentina' },
      { code: 'ALG', name: 'Argélia' },
      { code: 'AUT', name: 'Áustria' },
      { code: 'JOR', name: 'Jordânia' },
    ],
  },
  {
    group: 'K',
    teams: [
      { code: 'POR', name: 'Portugal' },
      { code: 'COD', name: 'Congo' },
      { code: 'UZB', name: 'Uzbequistão' },
      { code: 'COL', name: 'Colômbia' },
    ],
  },
  {
    group: 'L',
    teams: [
      { code: 'ENG', name: 'Inglaterra' },
      { code: 'CRO', name: 'Croácia' },
      { code: 'GHA', name: 'Gana' },
      { code: 'PAN', name: 'Panamá' },
    ],
  },
]

function buildStickers(): StickerDef[] {
  const stickers: StickerDef[] = []
  let pos = 0

  for (const { group, teams } of GROUPS) {
    for (const team of teams) {
      // Posição 00 (escudo/badge)
      stickers.push({
        id: `${team.code}00`,
        section: group,
        countryCode: team.code,
        countryName: team.name,
        number: '00',
        position: pos++,
      })
      // Posições 1–20
      for (let n = 1; n <= 20; n++) {
        stickers.push({
          id: `${team.code}${n}`,
          section: group,
          countryCode: team.code,
          countryName: team.name,
          number: String(n),
          position: pos++,
        })
      }
    }
  }

  // FWC History: posições 9–19
  for (let n = 9; n <= 19; n++) {
    stickers.push({
      id: `FWC${n}`,
      section: 'FWC',
      countryCode: 'FWC',
      countryName: 'FIFA World Cup History',
      number: String(n),
      position: pos++,
    })
  }

  // Coca-Cola: CC1–CC14
  for (let n = 1; n <= 14; n++) {
    stickers.push({
      id: `CC${n}`,
      section: 'CC',
      countryCode: 'CC',
      countryName: 'Coca-Cola',
      number: String(n),
      position: pos++,
    })
  }

  return stickers
}

export const ALL_STICKERS = buildStickers()

export const SECTIONS = [
  ...GROUPS.map((g) => ({
    id: g.group,
    label: `Grupo ${g.group}`,
    teams: g.teams,
  })),
  { id: 'FWC', label: 'FIFA World Cup History', teams: [] },
  { id: 'CC', label: 'Coca-Cola', teams: [] },
]
