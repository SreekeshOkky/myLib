export async function scanBarcode(container) {
  if (!('BarcodeDetector' in window)) {
    throw new Error('NOT_SUPPORTED')
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('NO_CAMERA_API')
  }

  const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'isbn_13', 'isbn_10', 'code_39', 'code_128']
  const detector = new BarcodeDetector({ formats })

  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
    })
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('PERMISSION_DENIED')
    }
    if (err.name === 'NotFoundError') {
      throw new Error('NO_CAMERA')
    }
    if (err.name === 'NotReadableError') {
      throw new Error('CAMERA_BUSY')
    }
    if (err.name === 'NotSupportedError' || err.name === 'SecurityError') {
      throw new Error('INSECURE_CONTEXT')
    }
    throw new Error('CAMERA_FAILED')
  }

  const video = document.createElement('video')
  video.srcObject = stream
  video.setAttribute('playsinline', '')
  video.setAttribute('autoplay', '')
  video.setAttribute('muted', '')
  video.style.width = '100%'
  video.style.maxHeight = '300px'
  video.style.borderRadius = '12px'
  video.style.objectFit = 'cover'
  video.style.background = '#000'

  if (container) {
    container.innerHTML = ''
    container.appendChild(video)
  }

  await new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play().then(resolve)
    }
  })

  return new Promise((resolve, reject) => {
    let stopped = false
    const stop = () => {
      if (stopped) return
      stopped = true
      stream.getTracks().forEach((t) => t.stop())
      video.remove()
    }

    const scan = async () => {
      if (stopped) return
      try {
        const codes = await detector.detect(video)
        if (codes.length > 0) {
          stop()
          resolve(codes[0].rawValue)
          return
        }
      } catch { }
      if (!stopped) requestAnimationFrame(scan)
    }

    scan()

    setTimeout(() => {
      if (!stopped) {
        stop()
        reject(new Error('TIMEOUT'))
      }
    }, 30000)
  })
}

export function isBarcodeSupported() {
  return 'BarcodeDetector' in window
}
