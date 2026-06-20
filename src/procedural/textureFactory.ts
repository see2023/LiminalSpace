import * as THREE from 'three'

function createCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  draw(ctx, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createWallpaperTexture(): THREE.CanvasTexture {
  return createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c4a040'
    ctx.fillRect(0, 0, w, h)

    const gradient = ctx.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, 'rgba(180, 140, 50, 0.15)')
    gradient.addColorStop(0.5, 'rgba(200, 170, 80, 0)')
    gradient.addColorStop(1, 'rgba(160, 120, 40, 0.2)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = '#b0903a'
    ctx.lineWidth = 0.8
    const stripeH = 12
    for (let y = 0; y < h; y += stripeH) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    ctx.globalAlpha = 0.06
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      ctx.fillStyle = Math.random() > 0.5 ? '#907030' : '#d4b860'
      ctx.fillRect(x, y, 1.5, 1.5)
    }
    ctx.globalAlpha = 1

    ctx.globalAlpha = 0.04
    ctx.fillStyle = '#604020'
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const r = 10 + Math.random() * 40
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }, 2, 2)
}

export function createCarpetTexture(): THREE.CanvasTexture {
  return createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7a6a48'
    ctx.fillRect(0, 0, w, h)

    for (let i = 0; i < 12000; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const shade = 55 + Math.random() * 50
      ctx.fillStyle = `rgb(${shade + 35}, ${shade + 22}, ${shade - 5})`
      ctx.fillRect(x, y, 1.2, 1.2)
    }

    ctx.globalAlpha = 0.04
    ctx.fillStyle = '#4a3a20'
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const r = 8 + Math.random() * 30
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }, 3, 3)
}

export function createCeilingTexture(): THREE.CanvasTexture {
  return createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ddd8c8'
    ctx.fillRect(0, 0, w, h)

    const tileSize = 64
    ctx.strokeStyle = '#c0b8a4'
    ctx.lineWidth = 1.5
    for (let x = 0; x <= w; x += tileSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y <= h; y += tileSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    ctx.globalAlpha = 0.03
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      ctx.fillStyle = '#a0988a'
      ctx.fillRect(x, y, 2, 2)
    }
    ctx.globalAlpha = 1
  }, 4, 4)
}

export function createPoolTileTexture(): THREE.CanvasTexture {
  return createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#a8d0e4'
    ctx.fillRect(0, 0, w, h)

    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    gradient.addColorStop(0, 'rgba(180, 220, 240, 0.2)')
    gradient.addColorStop(1, 'rgba(120, 180, 210, 0.1)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    const tileSize = 32
    ctx.strokeStyle = '#88b8d4'
    ctx.lineWidth = 1.5
    for (let x = 0; x <= w; x += tileSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y <= h; y += tileSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    ctx.globalAlpha = 0.08
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      ctx.fillStyle = '#60a0c0'
      ctx.fillRect(x, y, 2, 2)
    }
    ctx.globalAlpha = 1
  }, 5, 5)
}
