import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { CLASSIC, CLASSIC_STILL, GLASS, GLASS_STILL, MOTES, MOTES_STILL, SATIN, SATIN_STILL, SILK, SILK_STILL } from './scenes'

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
  classic: { svg: CLASSIC, still: CLASSIC_STILL, alt: 'Soft plum and rose light drifting through dark violet' },
  satin: { svg: SATIN, still: SATIN_STILL, alt: 'A satin ribbon of plum light catching a slow sweep of light' },
  glass: { svg: GLASS, still: GLASS_STILL, alt: 'Frosted glass forms floating in soft plum light' },
  motes: { svg: MOTES, still: MOTES_STILL, alt: 'Soft specks of warm light rising slowly through plum light' },
  silk: { svg: SILK, still: SILK_STILL, alt: 'Ribbons of plum, violet and rose light flowing like silk' },
} as const

type Variant = keyof typeof VARIANTS

const NAMES = Object.keys(VARIANTS).join(', ')

const isVariant = (name: unknown): name is Variant =>
  typeof name === 'string' && Object.hasOwn(VARIANTS, name)

// How far the app frosts its panels over the glow, in points (0 to 64). None by default,
// so the backdrop stays crisp; /velvet blur <n> changes it.
const DEFAULT_BLUR = 0

type Choice = { variant: Variant; isStill: boolean; blur: number }

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
  // Still is the light setting: a filter-free scene drawn as a plain image, with the panels
  // tinted but never frosted, since re-blurring the window behind them on every repaint is
  // what costs a modest GPU most. Moving: the live scene, frosted as /velvet blur says.
  const look: ThemeSetArgs = {
    colors: theme,
    backdrop: {
      scene: `velvet-${variant}${isStill ? '-still' : ''}`,
      glass: { blur: isStill ? 0 : blur, tint: '#140e1f', opacity: 0.58 },
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
    // The desktop app attaches after the session starts, so this set is usually not drawn
    // yet; the theme stands and draws when it attaches, so there is nothing to report.
    await apply($, await chosen($))

    return next(e)
  })

  on('command.run', { command: 'velvet' }, async ($, e) => {
    const [word = '', amount] = e.args.trim().toLowerCase().split(/\s+/)
    const now = await chosen($)
    const next: Choice = { ...now }
    const describe = (c: Choice) => `${c.variant}${c.isStill ? ', held still (light: no frosting; blur applies when moving)' : `, blur ${c.blur}`}`

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

    return { text: `Velvet: ${describe(next)}.` }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    const match = /^velvet-([a-z]+)(-still)?$/.exec(e.props.scene)

    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || match === null || !isVariant(match[1])) {
      return next(e)
    }
    const { svg, still, alt } = VARIANTS[match[1]]
    const { Svg } = $.ui.resolve(e)

    // Moving: a live frame, so the animation runs. Still: no filter, no motion, a plain image.
    return match[2] === undefined ? <Svg source={svg} alt={alt} isInteractive /> : <Svg source={still} alt={alt} />
  })
}
