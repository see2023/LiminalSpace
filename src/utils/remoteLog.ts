let installed = false

function getServerBase(): string {
  return window.location.origin
}

function send(level: string, msg: string) {
  const url = `${getServerBase()}/__vr_log`
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, JSON.stringify({ level, msg }))
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, msg }),
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // ignore network errors
  }

  try {
    if (import.meta.hot) {
      import.meta.hot.send('vr:log', { level, msg })
    }
  } catch {
    // ignore if HMR not available
  }
}

export function installRemoteErrorReporter() {
  if (installed) return
  installed = true

  const origError = console.error
  console.error = (...args: unknown[]) => {
    origError.apply(console, args)
    send('error', args.map(a => {
      if (a instanceof Error) return `${a.message}\n${a.stack}`
      return String(a)
    }).join(' '))
  }

  const origWarn = console.warn
  console.warn = (...args: unknown[]) => {
    origWarn.apply(console, args)
    send('warn', args.map(a => String(a)).join(' '))
  }

  window.addEventListener('error', (e) => {
    send('error', `[Uncaught] ${e.message} at ${e.filename}:${e.lineno}`)
  })

  window.addEventListener('unhandledrejection', (e) => {
    send('error', `[UnhandledPromise] ${e.reason}`)
  })
}
