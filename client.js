window.__ModuleLoader__.load({
  id: 'dsh-music',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    const NS = 'acgay-player'
    const STYLE_ID = 'dsh-music-css'
    const PANEL_ID = 'dsh-music'
    const SOURCE = 'dsh-acgay'
    const DEFAULT_PATH = '/category/music?dsh=1'
    const MAX_RESULTS = 30

    const CSS = `
.acgay-entry,
.acgay-mini,
.acgay-drawer,
.acgay-toast {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.acgay-entry {
  position: fixed;
  top: 11px;
  right: calc(var(--acgay-inset, 0px) + 168px);
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 50%;
  background: rgba(24,27,37,0.7);
  color: rgba(255,255,255,0.9);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  -webkit-app-region: no-drag;
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 10px rgba(0,0,0,0.18);
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, right 230ms cubic-bezier(.22,1,.36,1);
}
.acgay-entry:hover {
  background: rgba(60,66,86,0.92);
  border-color: rgba(255,255,255,0.24);
}
.acgay-entry:hover svg { transform: rotate(12deg); }
@keyframes acgay-spin { to { transform: rotate(360deg); } }
.acgay-entry-playing svg { animation: acgay-spin 4s linear infinite; }
.acgay-entry-playing .acgay-entry-dot { animation: acgay-pulse 1.8s ease-in-out infinite; }
@keyframes acgay-pulse { 50% { opacity: 0.35; } }
.acgay-entry svg { transition: transform 180ms ease; display: block; }
.acgay-entry:active { transform: scale(0.96); }
.acgay-entry-dot {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff7a59;
  box-shadow: 0 0 0 2px rgba(24,27,37,0.9);
}
.acgay-mini {
  position: fixed;
  top: 9px;
  right: calc(var(--acgay-inset, 0px) + 204px);
  z-index: 2147482999;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  width: min(430px, calc(100vw - var(--acgay-inset, 0px) - 280px));
  min-width: 300px;
  padding: 0 10px 0 6px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 999px;
  background: rgba(28,31,42,0.82);
  color: rgba(255,255,255,0.9);
  -webkit-app-region: no-drag;
  backdrop-filter: blur(14px);
  box-shadow: 0 3px 16px rgba(0,0,0,0.22);
  transition: right 230ms cubic-bezier(.22,1,.36,1), width 230ms cubic-bezier(.22,1,.36,1), opacity 180ms ease;
}
.acgay-mini-compact { width: min(300px, calc(100vw - var(--acgay-inset, 0px) - 280px)); }
.acgay-mini-cover {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  background-color: #41485f;
  flex: none;
}
.acgay-mini-text {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.15;
  cursor: pointer;
}
.acgay-mini-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
  font-weight: 500;
}
.acgay-mini-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9.5px;
  color: rgba(255,255,255,0.48);
  margin-top: 1px;
}
.acgay-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: none;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  transition: background 140ms ease, color 140ms ease;
}
.acgay-iconbtn:hover { background: rgba(255,255,255,0.12); color: #fff; }
.acgay-iconbtn:disabled { opacity: 0.35; cursor: default; }
.acgay-playbtn {
  background: rgba(255,122,89,0.95);
  color: #171a24;
  width: 25px;
  height: 25px;
}
.acgay-playbtn:hover { background: #ff9277; color: #171a24; }
.acgay-progress {
  position: relative;
  flex: 1;
  min-width: 48px;
  display: flex;
  align-items: center;
  height: 24px;
  cursor: pointer;
}
.acgay-progress-track {
  position: relative;
  width: 100%;
  height: 3px;
  border-radius: 999px;
  background: rgba(255,255,255,0.16);
  overflow: hidden;
}
.acgay-progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: #ff7a59;
  transition: width 400ms linear;
}
.acgay-time {
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.55);
  flex: none;
  min-width: 62px;
  text-align: right;
}
.acgay-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483001;
  width: min(760px, 94vw);
  display: flex;
  flex-direction: column;
  background: #0f1118;
  border-left: 1px solid rgba(255,255,255,0.1);
  box-shadow: -24px 0 60px rgba(0,0,0,0.36);
  transition: transform 230ms cubic-bezier(.2,.7,.2,1), opacity 180ms ease;
  will-change: transform, opacity;
}
.acgay-drawer-hidden {
  transform: translateX(100%);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: transform 230ms cubic-bezier(.2,.7,.2,1), opacity 180ms ease, visibility 0s linear 230ms;
}
.acgay-drawer-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 10px 0 14px;
  flex: none;
  background: #171a24;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.9);
}
.acgay-drawer-title {
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  flex: none;
}
.acgay-auth {
  flex: none;
  height: 28px;
  padding: 0 13px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.88);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}
.acgay-auth:hover {
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.24);
}
.acgay-search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  margin-left: 8px;
  height: 28px;
  padding: 0 9px;
  border-radius: 7px;
  background: rgba(255,255,255,0.07);
  border: 1px solid transparent;
  transition: border-color 140ms ease, background 140ms ease;
}
.acgay-search:focus-within {
  border-color: rgba(255,122,89,0.55);
  background: rgba(255,255,255,0.1);
}
.acgay-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: rgba(255,255,255,0.92);
  font-size: 11.5px;
  font-family: inherit;
}
.acgay-search input::placeholder { color: rgba(255,255,255,0.34); }
.acgay-search-clear {
  width: 16px;
  height: 16px;
  border: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0.14);
  color: rgba(255,255,255,0.7);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}
.acgay-drawer-body {
  position: relative;
  flex: 1;
  min-height: 0;
  background: #f7f5f0;
}
.acgay-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #f7f5f0;
}
.acgay-cover {
  position: absolute;
  inset: 48px 0 0 0;
  z-index: 2;
  overflow: auto;
  padding: 18px 20px 28px;
  background: #f7f5f0;
  color: #25272e;
  animation: acgay-fade-in 160ms ease;
}
@keyframes acgay-fade-in { from { opacity: 0; } to { opacity: 1; } }
.acgay-cover-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(37,39,46,0.12);
}
.acgay-cover-title { font-size: 14px; font-weight: 600; }
.acgay-cover-sub { font-size: 11px; color: #777a84; }
.acgay-cover-loading { padding: 34px 0; text-align: center; color: #777a84; font-size: 12px; }
.acgay-cover-empty { padding: 34px 0; text-align: center; color: #777a84; font-size: 12px; line-height: 1.7; }
.acgay-cover-list { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
.acgay-result-section {
  margin: 12px 0 4px;
  padding: 0 10px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #8a8d96;
  text-transform: uppercase;
}
.acgay-result-section:first-child { margin-top: 2px; }
.acgay-search-submit {
  flex: none;
  height: 24px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  background: #ff6b52;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}
.acgay-search-submit:hover { background: #ff5a3f; }
.acgay-result:disabled { opacity: 0.55; cursor: default; }
.acgay-result-badge {
  flex: none;
  min-width: 34px;
  font-size: 9.5px;
  font-weight: 600;
  color: #ff7a59;
  opacity: 0.9;
}
.acgay-result {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}
.acgay-result:hover { background: rgba(37,39,46,0.07); }
.acgay-result-id {
  flex: none;
  width: 34px;
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
  color: #a0a2aa;
}
.acgay-result-main { min-width: 0; flex: 1; }
.acgay-result-title {
  font-size: 12.5px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.acgay-result-meta {
  margin-top: 2px;
  font-size: 10px;
  color: #84868f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.acgay-result-go { flex: none; font-size: 10px; color: #ff7a59; opacity: 0.9; }
.acgay-notice {
  margin: 14px 0 0;
  padding: 12px 13px;
  border: 1px solid rgba(37,39,46,0.12);
  border-radius: 9px;
  background: #fffdf8;
  font-size: 11.5px;
  line-height: 1.65;
  color: #5c5f68;
}
.acgay-notice strong { color: #25272e; }
.acgay-notice-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }
.acgay-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 27px;
  padding: 0 12px;
  border: 1px solid rgba(37,39,46,0.18);
  border-radius: 7px;
  background: #fff;
  color: #363943;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
}
.acgay-btn:hover { border-color: rgba(255,122,89,0.6); color: #c8553a; }
.acgay-btn-primary {
  background: #ff7a59;
  border-color: #ff7a59;
  color: #1d2029;
}
.acgay-btn-primary:hover { background: #ff9277; border-color: #ff9277; color: #1d2029; }
.acgay-btn:disabled { opacity: 0.5; cursor: default; }
.acgay-footer-note {
  margin-top: 12px;
  font-size: 10px;
  color: #9a9ca4;
}
.acgay-toast {
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 2147483003;
  max-width: min(520px, 80vw);
  padding: 8px 14px;
  border-radius: 8px;
  background: rgba(20,22,30,0.94);
  color: rgba(255,255,255,0.9);
  font-size: 11.5px;
  line-height: 1.5;
  box-shadow: 0 6px 24px rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.12);
}
`

    function installStyles() {
      if (typeof document === 'undefined') return () => {}
      let tag = document.getElementById(STYLE_ID)
      if (!tag) {
        tag = document.createElement('style')
        tag.id = STYLE_ID
        tag.dataset.plugin = NS
        document.head.appendChild(tag)
      }
      if (tag.textContent !== CSS) tag.textContent = CSS
      return () => {
        const current = document.getElementById(STYLE_ID)
        if (current) current.remove()
      }
    }

    function formatTime(seconds) {
      const value = Number(seconds)
      if (!Number.isFinite(value) || value <= 0) return '0:00'
      const total = Math.floor(value)
      const minutes = Math.floor(total / 60)
      const rest = total % 60
      return `${minutes}:${String(rest).padStart(2, '0')}`
    }

    const IconMusic = (props) =>
      h(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          ...props,
        },
        h('path', { d: 'M9 18V5l12-2v13' }),
        h('circle', { cx: 6, cy: 18, r: 3 }),
        h('circle', { cx: 18, cy: 16, r: 3 }),
      )

    const IconVinyl = (props) =>
      h(
        'svg',
        {
          width: 17,
          height: 17,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.35,
          strokeLinecap: 'round',
          'aria-hidden': true,
          ...props,
        },
        h('circle', { cx: 12, cy: 12, r: 9 }),
        h('circle', { cx: 12, cy: 12, r: 5.4, opacity: 0.55 }),
        h('circle', { cx: 12, cy: 12, r: 1.5, fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M12 3a9 9 0 0 1 8.2 5.3', opacity: 0.35 }),
      )

    const IconPlay = (props) =>
      h(
        'svg',
        {
          width: 13,
          height: 13,
          viewBox: '0 0 24 24',
          fill: 'currentColor',
          'aria-hidden': true,
          ...props,
        },
        h('path', { d: 'M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z' }),
      )

    const IconPause = (props) =>
      h(
        'svg',
        {
          width: 13,
          height: 13,
          viewBox: '0 0 24 24',
          fill: 'currentColor',
          'aria-hidden': true,
          ...props,
        },
        h('rect', { x: 6, y: 4, width: 4, height: 16, rx: 1 }),
        h('rect', { x: 14, y: 4, width: 4, height: 16, rx: 1 }),
      )

    const IconPrev = (props) =>
      h(
        'svg',
        {
          width: 12,
          height: 12,
          viewBox: '0 0 24 24',
          fill: 'currentColor',
          'aria-hidden': true,
          ...props,
        },
        h('path', { d: 'M6 5h2v14H6zM20 5.5v13a1 1 0 0 1-1.55.83l-9.4-6.5a1 1 0 0 1 0-1.66l9.4-6.5A1 1 0 0 1 20 5.5Z' }),
      )

    const IconNext = (props) =>
      h(
        'svg',
        {
          width: 12,
          height: 12,
          viewBox: '0 0 24 24',
          fill: 'currentColor',
          'aria-hidden': true,
          ...props,
        },
        h('path', { d: 'M16 5h2v14h-2zM4 5.5v13a1 1 0 0 0 1.55.83l9.4-6.5a1 1 0 0 0 0-1.66l-9.4-6.5A1 1 0 0 0 4 5.5Z' }),
      )

    const IconClose = (props) =>
      h(
        'svg',
        {
          width: 13,
          height: 13,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          'aria-hidden': true,
          ...props,
        },
        h('path', { d: 'M6 6l12 12M18 6 6 18' }),
      )

    const IconSearch = (props) =>
      h(
        'svg',
        {
          width: 13,
          height: 13,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          'aria-hidden': true,
          ...props,
        },
        h('circle', { cx: 11, cy: 11, r: 7 }),
        h('path', { d: 'm20 20-3.5-3.5' }),
      )

    const IconReload = (props) =>
      h(
        'svg',
        {
          width: 13,
          height: 13,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.9,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          ...props,
        },
        h('path', { d: 'M20 11a8 8 0 1 0-2.34 5.66' }),
        h('path', { d: 'M20 4v7h-7' }),
      )

    const IconExternal = (props) =>
      h(
        'svg',
        {
          width: 13,
          height: 13,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.9,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          ...props,
        },
        h('path', { d: 'M14 4h6v6M20 4 10 14' }),
        h('path', { d: 'M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5' }),
      )

    function safeText(value) {
      return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
    }

    function resultFromItem(item, index) {
      const id = Number(item && item.id)
      const subject = safeText(item && (item.subject || item.title))
      const author = safeText(item && item.author)
      const categoryName = safeText(item && item.categoryName)
      return {
        key: Number.isFinite(id) && id > 0 ? `acgay-${id}` : `acgay-row-${index}`,
        id: Number.isFinite(id) && id > 0 ? id : null,
        title: subject || '未命名声音',
        author,
        categoryName,
        source: 'acgay',
      }
    }

    function resultFromBili(item, index) {
      const bvid = safeText(item && item.bvid)
      const title = safeText(item && item.title)
      return {
        key: bvid ? `bili-${bvid}` : `bili-row-${index}`,
        id: null,
        bvid,
        title: title || bvid || '在线视频',
        author: safeText(item && item.author),
        categoryName: '',
        durationText: safeText(item && item.durationText),
        source: 'online',
      }
    }

    function parseSearchHtml(html) {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const seen = new Set()
      const items = []
      const anchors = doc.querySelectorAll('a[href^="/sound/"]')
      for (const anchor of anchors) {
        const href = anchor.getAttribute('href') || ''
        const match = /^\/sound\/(\d+)/.exec(href)
        if (!match) continue
        const id = Number(match[1])
        if (!Number.isFinite(id) || seen.has(id)) continue
        const title = safeText(anchor.textContent)
        if (!title) continue
        seen.add(id)
        if (items.length >= MAX_RESULTS) break
        const card = anchor.closest('article,li,div')
        const meta = safeText(card ? card.textContent : '')
        items.push({
          key: `id-${id}`,
          id,
          title,
          author: meta && meta.includes(title) ? meta.replace(title, '').slice(0, 80).trim() : '',
          categoryName: '',
        })
      }
      return items
    }

    function findDshFrame() {
      const nodes = document.querySelectorAll('div[class]')
      for (const node of nodes) {
        const className = typeof node.className === 'string' ? node.className : ''
        if (/(^|\s)[A-Za-z0-9_-]*_frame(\s|$)/.test(className)) return node
      }
      return null
    }

    function AcgayPlayer() {
      const [open, setOpen] = useState(false)
      const [origin, setOrigin] = useState('')
      const [importsEnabled, setImportsEnabled] = useState(false)
      const [status, setStatus] = useState('loading')
      const [statusError, setStatusError] = useState('')
      const [player, setPlayer] = useState({
        current: null,
        playing: false,
        position: 0,
        duration: 0,
        volume: 0,
        source: 'none',
      })
      const [framePath, setFramePath] = useState(DEFAULT_PATH)
      const [frameKey, setFrameKey] = useState(0)
      const [query, setQuery] = useState('')
      const [results, setResults] = useState(null)
      const [searchBusy, setSearchBusy] = useState(false)
      const [searchError, setSearchError] = useState('')
      const [searchedFor, setSearchedFor] = useState('')
      const [importBusy, setImportBusy] = useState(false)
      const [biliImport, setBiliImport] = useState('')
      const searchInputRef = useRef(null)
      const [importMessage, setImportMessage] = useState('')
      const [loggedIn, setLoggedIn] = useState(false)
      const iframeRef = useRef(null)
      const toastTimer = useRef(null)

      useEffect(() => {
        const frame = findDshFrame()
        const inset = 'min(760px, 94vw)'
        const root = document.documentElement
        root.style.setProperty('--acgay-inset', open ? inset : '0px')
        if (frame) {
          if (!frame.dataset.acgayWidth) {
            frame.dataset.acgayWidth = frame.style.width || ''
            frame.style.transition = 'width 230ms cubic-bezier(0.22, 1, 0.36, 1)'
          }
          void frame.offsetWidth
          frame.style.width = open
            ? `calc(100% - ${inset})`
            : frame.dataset.acgayWidth
          requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
        }
        return () => {
          root.style.setProperty('--acgay-inset', '0px')
          if (frame) {
            void frame.offsetWidth
            frame.style.width = frame.dataset.acgayWidth || ''
          }
          requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
        }
      }, [open])

      const showToast = (message) => {
        setImportMessage(message)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setImportMessage(''), 4200)
      }

      useEffect(
        () => () => {
          if (toastTimer.current) clearTimeout(toastTimer.current)
        },
        [],
      )

      useEffect(() => {
        let cancelled = false
        fetch('/dsh-music/state', { credentials: 'same-origin' })
          .then(async (response) => {
            const data = await response.json().catch(() => ({}))
            if (!response.ok || !data || data.ok !== true) {
              throw new Error((data && data.error) || `状态接口返回 ${response.status}`)
            }
            return data
          })
          .then((data) => {
            if (cancelled) return
            setOrigin(String(data.origin || ''))
            setImportsEnabled(data.imports === true)
            setStatus('ready')
          })
          .catch((error) => {
            if (cancelled) return
            setStatus('error')
            setStatusError(String((error && error.message) || error))
          })
        return () => {
          cancelled = true
        }
      }, [])

      useEffect(() => {
        if (!origin) return undefined
        const onMessage = (event) => {
          if (event.origin !== origin) return
          const data = event.data
          if (!data || data.source !== SOURCE || data.type !== 'state') return
          const next = data.state || {}
          setPlayer({
            current: next.current || null,
            playing: !!next.playing,
            position: Number(next.position) || 0,
            duration: Number(next.duration) || 0,
            volume: Number(next.volume) || 0,
            source: next.source || 'none',
          })
          setLoggedIn(Boolean(next.loggedIn))
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
      }, [origin])

      const postCommand = (cmd, value) => {
        const win = iframeRef.current && iframeRef.current.contentWindow
        if (!win || !origin) return
        win.postMessage({ source: SOURCE, type: 'command', cmd, value }, origin)
      }

      const navigateFrame = (path) => {
        setFramePath(path)
        setFrameKey((value) => value + 1)
      }

      const openDrawer = () => {
        setOpen(true)
      }

      const closeDrawer = () => {
        setOpen(false)
      }

      useEffect(() => {
        if (!open) return undefined
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        const onPointerDown = (event) => {
          const target = event.target
          if (!(target instanceof Element)) return
          if (target.closest('.acgay-drawer, .acgay-entry, .acgay-mini, .acgay-toast')) return
          setOpen(false)
        }
        window.addEventListener('keydown', onKeyDown)
        document.addEventListener('pointerdown', onPointerDown, true)
        return () => {
          window.removeEventListener('keydown', onKeyDown)
          document.removeEventListener('pointerdown', onPointerDown, true)
        }
      }, [open])

      const searchAcgayFallback = async (term) => {
        const fallback = await fetch(
          `${origin}/search?q=${encodeURIComponent(term)}`,
          { credentials: 'omit' },
        )
        if (!fallback.ok) throw new Error(`站内搜索页不可用（${fallback.status}）`)
        const html = await fallback.text()
        let items = parseSearchHtml(html)
        if (items.length === 0) {
          // The site search matches the whole query as one LIKE pattern, so a
          // multi-word query such as "张信哲 别怕我伤心" misses a title like
          // "张信哲《别怕我伤心》". Retry the tokens and keep rows that match
          // every token, then merge the rows.
          const tokens = term
            .split(/[\s,，、/]+/)
            .map((part) => part.trim())
            .filter((part) => part.length >= 2)
            .slice(0, 4)
          const merged = new Map()
          for (const token of tokens) {
            try {
              const tokenResponse = await fetch(
                `${origin}/search?q=${encodeURIComponent(token)}`,
                { credentials: 'omit' },
              )
              if (!tokenResponse.ok) continue
              const tokenHtml = await tokenResponse.text()
              for (const item of parseSearchHtml(tokenHtml)) {
                if (item.id && !merged.has(item.id)) merged.set(item.id, item)
              }
            } catch {
              // One failed token is not fatal; try the remaining ones.
            }
          }
          items = [...merged.values()].filter((item) => {
            const haystack = `${item.title || ''} ${item.author || ''}`
            return tokens.length > 0 && tokens.every((token) => haystack.includes(token))
          })
        }
        return { items: items.slice(0, MAX_RESULTS), total: items.length, source: 'html' }
      }

      const searchAcgaySite = async (term) => {
        try {
          const response = await fetch(
            `${origin}/api/plugin/search?q=${encodeURIComponent(term)}`,
            { credentials: 'omit' },
          )
          if (!response.ok) throw new Error(`站点搜索接口不可用（${response.status}）`)
          const data = await response.json()
          if (!data || data.ok !== true) {
            throw new Error((data && data.error) || '搜索接口返回异常')
          }
          const items = Array.isArray(data.items)
            ? data.items.map(resultFromItem).slice(0, MAX_RESULTS)
            : []
          return { items, total: Number(data.total) || items.length, source: 'api' }
        } catch (apiError) {
          try {
            return await searchAcgayFallback(term)
          } catch (fallbackError) {
            throw new Error(
              String((fallbackError && fallbackError.message) || fallbackError) ||
                String((apiError && apiError.message) || apiError),
            )
          }
        }
      }

      const searchBiliSite = async (term) => {
        const response = await fetch(
          `${origin}/api/plugin/bili-search?q=${encodeURIComponent(term)}`,
          { credentials: 'omit' },
        )
        if (!response.ok) throw new Error(`在线搜索接口不可用（${response.status}）`)
        const data = await response.json()
        if (!data || data.ok !== true) {
          throw new Error((data && data.error) || '在线搜索接口返回异常')
        }
        const items = Array.isArray(data.items)
          ? data.items.map(resultFromBili).filter((item) => item.bvid).slice(0, MAX_RESULTS)
          : []
        return { items, total: items.length }
      }

      const submitSearch = async (event) => {
        if (event) event.preventDefault()
        const inputValue =
          searchInputRef.current && typeof searchInputRef.current.value === 'string'
            ? searchInputRef.current.value
            : ''
        const term = (inputValue || query).trim()
        if (!term) {
          setResults(null)
          setSearchError('')
          setSearchedFor('')
          return
        }
        setSearchBusy(true)
        setSearchError('')
        setResults(null)
        setSearchedFor(term)

        const [acgayResult, biliResult] = await Promise.allSettled([
          searchAcgaySite(term),
          searchBiliSite(term),
        ])

        const acgay = acgayResult.status === 'fulfilled' ? acgayResult.value : { items: [], total: 0, source: 'api' }
        const bili = biliResult.status === 'fulfilled' ? biliResult.value : { items: [], total: 0 }
        const biliError =
          biliResult.status === 'rejected'
            ? String((biliResult.reason && biliResult.reason.message) || biliResult.reason)
            : ''

        if (acgayResult.status === 'rejected' && acgay.items.length === 0 && bili.items.length === 0) {
          setSearchError(
            String((acgayResult.reason && acgayResult.reason.message) || acgayResult.reason),
          )
        }

        setResults({
          acgay: acgay.items,
          bili: bili.items,
          acgayTotal: acgay.total,
          biliTotal: bili.total,
          acgaySource: acgay.source,
          biliError,
        })
        setSearchBusy(false)
      }

      const openResult = (item) => {
        if (!item || !item.id) {
          showToast('这个结果没有可跳转的曲目 ID')
          return
        }
        setResults(null)
        setSearchError('')
        setSearchedFor('')
        setSearchBusy(false)
        navigateFrame(`/sound/${item.id}`)
      }

      const runImport = async () => {
        const term = searchedFor || query.trim()
        if (!term || importBusy) return
        setImportBusy(true)
        setSearchError('')
        try {
          const response = await fetch('/dsh-music/import', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ query: term }),
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok || !data || data.ok !== true) {
            throw new Error((data && data.error) || `自动入库接口返回 ${response.status}`)
          }
          const prodId = Number(data.prodId) || 0
          showToast(data.message || '已抓取并上架')
          setResults(null)
          setSearchedFor('')
          setSearchError('')
          setTimeout(() => {
            navigateFrame(prodId > 0 ? `/sound/${prodId}` : `/search?q=${encodeURIComponent(term)}`)
          }, 900)
        } catch (error) {
          setSearchError(String((error && error.message) || error))
        } finally {
          setImportBusy(false)
        }
      }

      const importBili = async (item) => {
        if (!importsEnabled) {
          showToast('未配置 ACGAY_IMPORT_TOKEN，导入功能已关闭')
          return
        }
        if (!item || !item.bvid || biliImport) return
        setBiliImport(item.bvid)
        setSearchError('')
        try {
          const response = await fetch('/dsh-music/import', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ query: item.bvid }),
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok || !data || data.ok !== true) {
            throw new Error((data && data.error) || `导入接口返回 ${response.status}`)
          }
          const prodId = Number(data.prodId) || 0
          showToast(data.message || '已导入并上架')
          setResults(null)
          setSearchedFor('')
          setSearchError('')
          setTimeout(() => {
            navigateFrame(prodId > 0 ? `/sound/${prodId}` : `/search?q=${encodeURIComponent(item.title)}`)
          }, 900)
        } catch (error) {
          setSearchError(String((error && error.message) || error))
        } finally {
          setBiliImport('')
        }
      }

      const current = player.current
      const duration = player.duration
      const position = Math.min(player.position, duration || player.position)
      const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0
      const searchOpen = Boolean(results) || searchBusy || Boolean(searchError) || Boolean(searchedFor)

      const mini = useMemo(() => {
        if (!current) return null
        const title = safeText(current.title) || 'acgay 音乐'
        const subtitle = safeText(current.artist) || safeText(current.categoryName) || 'acgay'
        const coverStyle = current.cover ? { backgroundImage: `url("${current.cover}")` } : undefined
        return h(
          'div',
          { className: `acgay-mini${open ? ' acgay-mini-compact' : ''}`, role: 'group', 'aria-label': 'acgay 迷你播放器' },
          h('div', { className: 'acgay-mini-cover', style: coverStyle }),
          h(
            'button',
            {
              type: 'button',
              className: 'acgay-iconbtn',
              title: '上一首',
              onClick: () => postCommand('prev'),
            },
            h(IconPrev, null),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'acgay-iconbtn acgay-playbtn',
              title: player.playing ? '暂停' : '播放',
              onClick: () => postCommand('toggle'),
            },
            player.playing ? h(IconPause, null) : h(IconPlay, null),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'acgay-iconbtn',
              title: '下一首',
              onClick: () => postCommand('next'),
            },
            h(IconNext, null),
          ),
          h(
            'div',
            { className: 'acgay-mini-text', title, onClick: openDrawer },
            h('div', { className: 'acgay-mini-title' }, title),
            h('div', { className: 'acgay-mini-sub' }, subtitle),
          ),
          h(
            'div',
            {
              className: 'acgay-progress',
              role: 'slider',
              'aria-label': '播放进度',
              'aria-valuemin': 0,
              'aria-valuemax': duration || 0,
              'aria-valuenow': position,
              tabIndex: 0,
              onKeyDown: (event) => {
                if (event.key === 'ArrowLeft') postCommand('seek', Math.max(0, position - 5))
                if (event.key === 'ArrowRight') postCommand('seek', Math.min(duration || position + 5, position + 5))
              },
              onClick: (event) => {
                if (!duration) return
                const rect = event.currentTarget.getBoundingClientRect()
                const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
                postCommand('seek', ratio * duration)
              },
            },
            h('div', { className: 'acgay-progress-track' }, h('div', { className: 'acgay-progress-fill', style: { width: `${pct}%` } })),
          ),
          h('div', { className: 'acgay-time' }, `${formatTime(position)} / ${formatTime(duration)}`),
        )
      }, [current, player.playing, position, duration, pct])

      const acgayItems = (results && results.acgay) || []
      const biliItems = (results && results.bili) || []
      const acgayTotal = results ? results.acgayTotal : 0
      const biliTotal = results ? results.biliTotal : 0
      const hasSearchResults = acgayItems.length > 0 || biliItems.length > 0

      const searchSectionTitle = (text) =>
        h('div', { className: 'acgay-result-section' }, text)

      const searchPanel = searchOpen
        ? h(
            'div',
            { className: 'acgay-cover' },
            h(
              'div',
              { className: 'acgay-cover-head' },
              h('div', { className: 'acgay-cover-title' }, searchedFor ? `搜索「${searchedFor}」` : '搜索 acgay'),
              h(
                'div',
                { className: 'acgay-cover-sub' },
                results
                  ? `acgay ${acgayTotal} 条 · 在线 ${biliTotal} 条${
                      results.acgaySource === 'html' ? ' · 站内页面解析' : ''
                    }`
                  : searchBusy
                    ? '搜索中…'
                    : '',
              ),
            ),
            searchBusy
              ? h('div', { className: 'acgay-cover-loading' }, '正在同时搜索 acgay 和在线曲库曲库…')
              : hasSearchResults
                ? h(
                    'div',
                    { className: 'acgay-cover-list' },
                    acgayItems.length
                      ? searchSectionTitle(`acgay 站内 · ${acgayTotal}`)
                      : null,
                    acgayItems.map((item) =>
                      h(
                        'button',
                        {
                          key: item.key,
                          type: 'button',
                          className: 'acgay-result',
                          onClick: () => openResult(item),
                        },
                        h('span', { className: 'acgay-result-id' }, item.id ? `#${item.id}` : '—'),
                        h(
                          'span',
                          { className: 'acgay-result-main' },
                          h('span', { className: 'acgay-result-title' }, item.title),
                          item.author || item.categoryName
                            ? h(
                                'span',
                                { className: 'acgay-result-meta' },
                                [item.author, item.categoryName].filter(Boolean).join(' · '),
                              )
                            : null,
                        ),
                        h('span', { className: 'acgay-result-go' }, '播放'),
                      ),
                    ),
                    biliItems.length
                      ? searchSectionTitle(`在线 · ${biliTotal}`)
                      : null,
                    biliItems.map((item) =>
                      h(
                        'div',
                        { key: item.key, className: 'acgay-result' },
                        h('span', { className: 'acgay-result-badge' }, '在线'),
                        h(
                          'span',
                          { className: 'acgay-result-main' },
                          h('span', { className: 'acgay-result-title' }, item.title),
                          h(
                            'span',
                            { className: 'acgay-result-meta' },
                            [item.author, item.durationText].filter(Boolean).join(' · ') || '在线视频',
                          ),
                        ),
                        importsEnabled
                          ? h(
                              'button',
                              {
                                type: 'button',
                                className: 'acgay-btn acgay-btn-primary acgay-result-go',
                                disabled: biliImport === item.bvid,
                                onClick: () => importBili(item),
                              },
                              biliImport === item.bvid ? '导入中…' : '导入',
                            )
                          : h('span', { className: 'acgay-result-go' }, '导入未启用'),
                      ),
                    ),
                  )
                : h(
                    'div',
                    { className: 'acgay-cover-empty' },
                    h('div', null, `没有找到「${searchedFor || query.trim()}」`),
                    h(
                      'div',
                      { className: 'acgay-notice' },
                      h(
                        'div',
                        null,
                        'acgay 站内和 在线都没有可用的单曲结果。可以让插件按关键词继续抓取一首，上传后自动过审上架。',
                      ),
                      h(
                        'div',
                        { className: 'acgay-notice-actions' },
                        importsEnabled
                          ? h(
                              'button',
                              {
                                type: 'button',
                                className: 'acgay-btn acgay-btn-primary',
                                disabled: importBusy,
                                onClick: runImport,
                              },
                              importBusy ? '抓取中…' : '抓取并入库',
                            )
                          : null,
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'acgay-btn',
                            onClick: () => {
                              setResults(null)
                              setSearchError('')
                              setSearchedFor('')
                            },
                          },
                          '返回页面',
                        ),
                      ),
                      h(
                        'div',
                        { className: 'acgay-footer-note' },
                        importsEnabled
                          ? '抓取会调用 acgay 的导入接口，上传后默认过审并直接上架。'
                          : '未配置 ACGAY_IMPORT_TOKEN，仅支持搜索和播放；配置后重启插件即可启用导入。',
                      ),
                    ),
                  ),
            !importsEnabled && results
              ? h(
                  'div',
                  { className: 'acgay-footer-note' },
                  '导入功能未启用：设置 ACGAY_IMPORT_TOKEN 后重启插件。',
                )
              : null,
            results && results.biliError
              ? h(
                  'div',
                  { className: 'acgay-footer-note' },
                  `在线搜索暂不可用：${results.biliError}`,
                )
              : null,
            searchError
              ? h(
                  'div',
                  { className: 'acgay-notice' },
                  h('strong', null, '搜索遇到问题：'),
                  ' ',
                  searchError,
                  h(
                    'div',
                    { className: 'acgay-notice-actions' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'acgay-btn',
                        onClick: () => {
                          const term = searchedFor || query
                          setSearchError('')
                          setResults(null)
                          setSearchedFor('')
                          navigateFrame(`/search?q=${encodeURIComponent(term)}`)
                        },
                      },
                      '在页面里打开搜索',
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'acgay-btn',
                        onClick: () => {
                          setSearchError('')
                          setResults(null)
                          setSearchedFor('')
                        },
                      },
                      '关闭',
                    ),
                  ),
                )
              : null,
            h(
              'div',
              { className: 'acgay-footer-note' },
              'acgay 站内结果优先；在线结果点「导入」会直接走 acgay 的导入接口并默认过审上架。',
            ),
          )
        : null

      const drawer = h(
            'aside',
            {
              className: `acgay-drawer${open ? '' : ' acgay-drawer-hidden'}`,
              'aria-label': 'acgay 音乐抽屉',
              'aria-hidden': !open,
            },
            h(
              'div',
              { className: 'acgay-drawer-head' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'acgay-auth',
                  title: loggedIn ? '打开我的主页' : '登录 acgay',
                  onClick: () => navigateFrame(loggedIn ? '/me' : '/login'),
                },
                loggedIn ? '我的' : '登录',
              ),
              h(
                'form',
                { className: 'acgay-search', onSubmit: submitSearch },
                h(IconSearch, null),
                h('input', {
                  type: 'search',
                  ref: searchInputRef,
                  value: query,
                  placeholder: '搜歌名、歌手，站内没有就抓取',
                  'aria-label': '搜索 acgay 音乐',
                  onChange: (event) => setQuery(event.target.value),
                }),
                query
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'acgay-search-clear',
                        title: '清空',
                        onClick: () => {
                          setQuery('')
                          setResults(null)
                          setSearchError('')
                          setSearchedFor('')
                        },
                      },
                      '×',
                    )
                  : null,
                h(
                  'button',
                  {
                    type: 'submit',
                    className: 'acgay-search-submit',
                    title: '搜索 acgay 和 在线',
                  },
                  '搜索',
                ),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'acgay-iconbtn',
                  title: '关闭',
                  onClick: closeDrawer,
                },
                h(IconClose, null),
              ),
            ),
            h(
              'div',
              { className: 'acgay-drawer-body' },
              origin
                ? h('iframe', {
                    key: frameKey,
                    ref: iframeRef,
                    className: 'acgay-frame',
                    title: 'acgay 音乐',
                    src: `${origin}${framePath}`,
                    allow: 'autoplay; clipboard-write; encrypted-media; fullscreen',
                    referrerPolicy: 'no-referrer',
                  })
                : h(
                    'div',
                    { className: 'acgay-cover-empty' },
                    status === 'error'
                      ? `代理启动失败：${statusError}`
                      : '正在启动 acgay 代理…',
                  ),
              searchPanel,
            ),
          )

      const entry = h(
        'button',
        {
          type: 'button',
          className: `acgay-entry${player.playing ? ' acgay-entry-playing' : ''}`,
          title: open ? '关闭 acgay 音乐' : player.playing ? 'acgay 音乐播放中' : '打开 acgay 音乐',
          onClick: open ? closeDrawer : openDrawer,
        },
        h('span', { className: 'acgay-entry-dot' }),
        h(IconVinyl, null),
      )

      return ReactDOM.createPortal(
        h(React.Fragment, null, entry, mini, drawer, importMessage ? h('div', { className: 'acgay-toast' }, importMessage) : null),
        document.body,
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => installStyles(), 'acgay-player: styles')
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: PANEL_ID,
              order: 90,
              label: () => 'acgay',
            },
            AcgayPlayer,
          ),
        )
      },
    }
  },
})
