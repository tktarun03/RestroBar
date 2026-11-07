// QR codes: pack data small, draw it, and read it with the camera.
// Uses vendored lib/qrcode-1.4.4.js (global `qrcode`) and lib/jsQR-1.4.0.js (global `jsQR`).
const QR = (() => {
  const b64u = (bytes) => {
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64u = (str) => {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out;
  };
  const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

  // "RB1:" = deflate-raw + base64url. "RB0:" = plain base64url when compression is missing.
  const pack = async (obj) => {
    const raw = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream !== 'undefined') {
      try { return 'RB1:' + b64u(await pipe(raw, new CompressionStream('deflate-raw'))); } catch { /* fall through */ }
    }
    return 'RB0:' + b64u(raw);
  };
  const unpack = async (text) => {
    if (typeof text !== 'string') throw new Error('bad');
    if (text.startsWith('RB1:')) {
      if (typeof DecompressionStream === 'undefined') throw new Error(t('This device is too old to read compressed codes. Update the browser.'));
      return JSON.parse(new TextDecoder().decode(await pipe(unb64u(text.slice(4)), new DecompressionStream('deflate-raw'))));
    }
    if (text.startsWith('RB0:')) return JSON.parse(new TextDecoder().decode(unb64u(text.slice(4))));
    throw new Error(t('This is not a RestroBar code.'));
  };

  const svg = (text) => {
    if (typeof qrcode !== 'function') return `<p class="muted">${t('QR library failed to load.')}</p>`;
    const q = qrcode(0, 'L'); q.addData(text, 'Byte'); q.make();
    const n = q.getModuleCount();
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) path += `M${c + 4},${r + 4}h1v1h-1z`;
    return `<svg class="qr" viewBox="0 0 ${n + 8} ${n + 8}" role="img" aria-label="QR code" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  };

  // Camera reader inside a container. Returns stop(). Calls onText(text) once per distinct code.
  const startCamera = async (container, onText, facing = 'environment') => {
    const video = document.createElement('video');
    video.setAttribute('playsinline', ''); video.muted = true;
    container.innerHTML = ''; container.appendChild(video);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let stream = null; let stopped = false; let last = '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      if (facing === 'user') video.classList.add('mirror');
    } catch (e) {
      container.innerHTML = `<p class="banner warn">${t('Camera not available. Allow camera access in the browser settings, or use "Choose photo".')}</p>`;
      return () => {};
    }
    video.srcObject = stream;
    try { await video.play(); } catch { /* autoplay */ }
    const tick = () => {
      if (stopped) return;
      if (video.readyState >= 2 && typeof jsQR === 'function') {
        const w = video.videoWidth; const h = video.videoHeight;
        const k = Math.min(1, 720 / Math.max(w, h));
        canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (res && res.data && res.data !== last) { last = res.data; onText(res.data); }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { stopped = true; if (stream) stream.getTracks().forEach((x) => x.stop()); };
  };

  // Read a QR from a photo file (fallback when live camera is blocked).
  const fromFile = (file) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const k = Math.min(1, 1200 / Math.max(img.width, img.height));
      c.width = img.width * k; c.height = img.height * k;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height);
      const r = typeof jsQR === 'function' ? jsQR(d.data, d.width, d.height) : null;
      URL.revokeObjectURL(img.src);
      res(r ? r.data : null);
    };
    img.onerror = () => res(null);
    img.src = URL.createObjectURL(file);
  });

  // Full-screen scan sheet. onText may return true to close.
  const scanSheet = (title, onText) => {
    let stop = () => {};
    let closed = false;
    UI.open(`
      <h2 class="sheet-title">${Util.esc(title)}</h2>
      <div class="cam" id="cam"></div>
      <div class="row between gap">
        <label class="btn ghost">${UI.icon('upload')} ${t('Choose photo')}<input type="file" accept="image/*" id="qr-photo" hidden></label>
        <button class="btn ghost" data-close>${t('Cancel')}</button>
      </div>`, {
      noFocus: true,
      onClose: () => { closed = true; stop(); },
      onMount: async (el, close) => {
        const handle = async (txt) => { if (await onText(txt)) close(); };
        el.querySelector('#qr-photo').onchange = async (e) => {
          const f = e.target.files[0]; if (!f) return;
          const txt = await fromFile(f);
          if (txt) handle(txt); else UI.toast(t('No QR code found in that photo'), 'bad');
        };
        stop = await startCamera(el.querySelector('#cam'), handle);
        if (closed) stop(); // sheet closed while the camera was starting
      }
    });
  };

  return { pack, unpack, svg, startCamera, scanSheet, fromFile };
})();
