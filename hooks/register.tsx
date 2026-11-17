import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { CLASSIC, GLASS, MOTES, SATIN, SILK } from './scenes'

// Dark velvet: plum-tinted surfaces, lavender accent, rose highlights.
const { theme, problems } = makeColors({
  label: 'Velvet',
  only: 'dark',
  roles: { accent: '#c08ef0', danger: '#e5737f', success: '#8fd19e', warning: '#e8b468', pro: '#e39ac8' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#130d1d',
        'surface-1': '#1b1328',
        'surface-2': '#221832',
        'surface-3': '#261b38',
        'text-primary': '#f2ebf7',
        'text-secondary': '#cdc0db',
        'text-muted': '#a798ba',
      },
    },
  },
})

const VARIANTS = {
  classic: { svg: CLASSIC, alt: 'Soft plum and rose light drifting through dark violet' },
  satin: { svg: SATIN, alt: 'A satin ribbon of plum light catching a slow sweep of light' },
  glass: { svg: GLASS, alt: 'Frosted glass forms floating in soft plum light' },
  motes: { svg: MOTES, alt: 'Soft specks of warm light rising slowly through plum light' },
  silk: { svg: SILK, alt: 'Ribbons of plum, violet and rose light flowing like silk' },
} as const

type Variant = keyof typeof VARIANTS

const NAMES = Object.keys(VARIANTS).join(', ')

const isVariant = (name: unknown): name is Variant =>
  typeof name === 'string' && Object.hasOwn(VARIANTS, name)

// How far the app frosts its panels over the glow, in points (0 to 64). None by default,
// so the backdrop stays crisp; /velvet blur <n> changes it.
const DEFAULT_BLUR = 0

// Appended to a scene to hold it still.
const STILL = '<style>*{animation:none!important}</style></svg>'

type Choice = { variant: Variant; isStill: boolean; blur: number }

// Set when session.start pinned "nothing draws it yet": the desktop app usually attaches
// after the session starts, so the first backdrop drawn (or a /velvet that draws) clears it.
let isNoticePinned = false

function clearNotice($: EngineInterface) {
  if (isNoticePinned) {
    isNoticePinned = false
    $.ui.status(undefined)
  }
}

async function chosen($: EngineInterface): Promise<Choice> {
  const variant = await $.store.get('variant')
  const isStill = (await $.store.get('still')) === true
  const blur = await $.store.get('blur')

  return {
    variant: isVariant(variant) ? variant : 'silk',
    isStill,
    blur: typeof blur === 'number' && blur >= 0 && blur <= 64 ? blur : DEFAULT_BLUR,
  }
}

async function apply($: EngineInterface, { variant, isStill, blur }: Choice) {
  const look: ThemeSetArgs = {
    colors: theme,
    backdrop: {
      scene: `velvet-${variant}${isStill ? '-still' : ''}`,
      glass: { blur, tint: '#140e1f', opacity: 0.58 },
    },
  }

  return $.theme.set(look)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    await $.command.register({
      name: 'velvet',
      description: `Switch the Velvet backdrop (${NAMES}), hold it still / move, or set blur 0-64`,
    })
    const set = await apply($, await chosen($))

    if (!set.isDrawn) {
      isNoticePinned = true
      $.ui.status(set.reason)
    } else {
      // A reload resets isNoticePinned, so drop any notice an earlier load left behind.
      $.ui.status(undefined)
    }

    return next(e)
  })

  on('command.run', { command: 'velvet' }, async ($, e) => {
    const [word = '', amount] = e.args.trim().toLowerCase().split(/\s+/)
    const now = await chosen($)
    const next: Choice = { ...now }
    const describe = (c: Choice) => `${c.variant}${c.isStill ? ', held still' : ''}, blur ${c.blur}`

    if (isVariant(word)) {
      next.variant = word
    } else if (word === 'still') {
      next.isStill = true
    } else if (word === 'move') {
      next.isStill = false
    } else if (word === 'blur' && amount !== undefined && /^\d+$/.test(amount) && Number(amount) <= 64) {
      next.blur = Number(amount)
    } else {
      return {
        text: `Velvet is on ${describe(now)}. Try /velvet ${NAMES}; /velvet still or move; /velvet blur 0-64 (default ${DEFAULT_BLUR}).`,
      }
    }
    await $.store.set('variant', next.variant)
    await $.store.set('still', next.isStill)
    await $.store.set('blur', next.blur)
    const set = await apply($, next)

    if (!set.isDrawn) {
      return { text: `Saved, but nothing draws it here: ${set.reason}` }
    }
    clearNotice($)

    return { text: `Velvet: ${describe(next)}.` }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    const match = /^velvet-([a-z]+)(-still)?$/.exec(e.props.scene)

    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || match === null || !isVariant(match[1])) {
      return next(e)
    }
    clearNotice($)
    const { svg, alt } = VARIANTS[match[1]]
    const { Svg } = $.ui.resolve(e)

    // Moving: a live frame, so the CSS animation runs. Still: a plain image, which the app
    // rasterizes once and reuses, instead of a live frame that keeps the large blur filters
    // on the GPU and can redraw them on every repaint of the panels above it.
    if (match[2] === undefined) {
      return <Svg source={svg} alt={alt} isInteractive />
    }

    return <Svg source={svg.replace('</svg>', STILL)} alt={alt} />
  })
}
