/* dsh-acgay-player — proxy-injected page bridge.
 *
 * Runs inside the proxied acgay iframe. The Host proxy injects this script into
 * every HTML page. It reports the site player state to the DSH parent and
 * accepts commands from it.
 *
 * When the site exposes `window.__ACGAY_PLAYER__` (the acgay app's own bridge),
 * that API is authoritative for title/queue/next/prev. Until that site bridge
 * is deployed, the script falls back to the single <audio> element: play,
 * pause, seek and next-at-track-end still work, prev is best effort.
 */
(function () {
  'use strict'

  var FLAG = '__dshAcgayBridgeInstalled'
  if (window[FLAG]) return
  window[FLAG] = true

  var SOURCE = 'dsh-acgay'
  var parentWindow = window.parent
  var embedded = parentWindow && parentWindow !== window
  var lastPayload = ''

  /** The drawer already supplies chrome, so drop the site's own header,
   * footer and mobile tab bar in the embedded view. */
  function applyEmbedChrome() {
    if (document.getElementById('dsh-acgay-embed-style')) return
    var style = document.createElement('style')
    style.id = 'dsh-acgay-embed-style'
    style.textContent = [
      'header.sticky.top-0.z-50{display:none!important}',
      'body > div.flex.min-h-dvh.flex-col > footer{display:none!important}',
      'nav[aria-label="底部导航"]{display:none!important}',
    ].join('\n')
    ;(document.head || document.documentElement).appendChild(style)
  }

  function siteLoggedIn() {
    try {
      return !document.querySelector('header a[href^="/login"]')
    } catch (error) {
      return false
    }
  }

  function siteApi() {
    try {
      return window.__ACGAY_PLAYER__ || null
    } catch (error) {
      return null
    }
  }

  function audioElement() {
    return document.querySelector('audio')
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\s*[—–-]\s*幻想の城.*$/, '')
      .trim()
  }

  function metaContent(property) {
    var node = document.querySelector('meta[property="' + property + '"]')
    return node ? node.getAttribute('content') || '' : ''
  }

  /** Title from the site's fixed mini player (works on category pages). */
  function domTrackTitle() {
    var button = document.querySelector('button[aria-label="暂停播放"],button[aria-label="继续播放"]')
    var container = button ? button.closest('div[class*="fixed"]') : null
    var link = container ? container.querySelector('a[href^="/sound/"]') : null
    if (link) {
      var title = cleanText(link.textContent)
      if (title) return title
    }
    var og = cleanText(metaContent('og:title'))
    if (og && og !== cleanText(document.title)) return og
    return cleanText(document.title)
  }

  function domTrackId() {
    var button = document.querySelector('button[aria-label="暂停播放"],button[aria-label="继续播放"]')
    var container = button ? button.closest('div[class*="fixed"]') : null
    var link = container ? container.querySelector('a[href^="/sound/"]') : null
    var match = link ? /\/sound\/(\d+)/.exec(link.getAttribute('href') || '') : null
    return match ? Number(match[1]) : null
  }

  function snapshot() {
    var api = siteApi()
    if (api && typeof api.getState === 'function') {
      try {
        var state = api.getState() || {}
        var current = state.current || null
        return {
          current: current
            ? {
                id: current.id,
                title: current.title,
                artist: current.artist,
                cover: current.cover,
                url: current.url,
                categoryName: current.categoryName,
                section: current.section,
              }
            : null,
          playing: !!state.isPlaying,
          position: Number(state.progress) || 0,
          duration: Number(state.duration) || 0,
          volume: Number(state.volume) || 0,
          source: 'site',
          loggedIn: siteLoggedIn(),
        }
      } catch (error) {
        // Fall through to the element bridge.
      }
    }

    var audio = audioElement()
    if (!audio) {
      return { current: null, playing: false, position: 0, duration: 0, source: 'none', loggedIn: siteLoggedIn() }
    }
    var id = domTrackId()
    var title = domTrackTitle()
    return {
      current: audio.src
        ? {
            id: id,
            title: title || 'acgay 音乐',
            artist: '',
            cover: metaContent('og:image'),
            url: audio.src,
            categoryName: '',
            section: 'music',
          }
        : null,
      playing: !audio.paused,
      position: Number(audio.currentTime) || 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      volume: Number(audio.volume) || 0,
      source: 'element',
      loggedIn: siteLoggedIn(),
    }
  }

  function postState(force) {
    if (!embedded) return
    var state = snapshot()
    var payload = JSON.stringify(state)
    if (!force && payload === lastPayload) return
    lastPayload = payload
    try {
      parentWindow.postMessage({ source: SOURCE, type: 'state', state: state }, '*')
    } catch (error) {
      // Parent may be navigating away.
    }
  }

  /** Click the previous/next sound card's play control.
   *
   * The site's PlayerProvider only advances a queue that the caller passed to
   * play(). Sound cards deliberately do not pass one, so a card started from a
   * list has a single-item queue and `next` is a no-op. Walking the rendered
   * cards keeps the top player bar useful for those plays too. On a detail
   * page the current sound is not a card, so `next` starts the first related
   * card and `prev` the last one.
   */
  function clickAdjacentCard(direction) {
    var articles = Array.prototype.slice.call(document.querySelectorAll('article'))
    if (!articles.length) return false

    function playButton(article, activeToo) {
      var selector = activeToo
        ? 'button[aria-label^="播放 "],button[aria-label^="暂停 "]'
        : 'button[aria-label^="播放 "]'
      return article.querySelector(selector)
    }

    var currentId = domTrackId()
    var activeIndex = -1
    if (currentId) {
      for (var i = 0; i < articles.length; i += 1) {
        if (articles[i].querySelector('a[href="/sound/' + currentId + '"]')) {
          activeIndex = i
          break
        }
      }
    }

    if (activeIndex < 0) {
      var ordered = direction > 0 ? articles : articles.slice().reverse()
      for (var j = 0; j < ordered.length; j += 1) {
        var first = playButton(ordered[j], false)
        if (first) {
          first.click()
          return true
        }
      }
      return false
    }

    for (var k = activeIndex + direction; k >= 0 && k < articles.length; k += direction) {
      var button = playButton(articles[k], false)
      if (button) {
        button.click()
        return true
      }
    }
    return false
  }

  function command(message) {
    if (!message || message.source !== SOURCE || message.type !== 'command') return
    var cmd = message.cmd
    var api = siteApi()
    if (api) {
      try {
        if (cmd === 'play' && typeof api.play === 'function') {
          api.play()
          return
        }
        if (cmd === 'pause' && typeof api.pause === 'function') {
          api.pause()
          return
        }
        if (cmd === 'toggle' && typeof api.toggle === 'function') {
          api.toggle()
          return
        }
        if (cmd === 'next' && typeof api.next === 'function') {
          api.next()
          return
        }
        if (cmd === 'prev' && typeof api.prev === 'function') {
          api.prev()
          return
        }
        if (cmd === 'seek' && typeof api.seek === 'function') {
          api.seek(Number(message.value) || 0)
          return
        }
      } catch (error) {
        // Fall through to the element path.
      }
    }

    var audio = audioElement()
    if (!audio) return
    if (cmd === 'play') {
      var started = audio.play()
      if (started && typeof started.catch === 'function') started.catch(function () {})
    } else if (cmd === 'pause') {
      audio.pause()
    } else if (cmd === 'toggle') {
      if (audio.paused) {
        var resumed = audio.play()
        if (resumed && typeof resumed.catch === 'function') resumed.catch(function () {})
      } else {
        audio.pause()
      }
    } else if (cmd === 'seek') {
      var target = Number(message.value)
      var max = Number.isFinite(audio.duration) ? audio.duration : target
      audio.currentTime = Math.max(0, Math.min(max || 0, target || 0))
    } else if (cmd === 'next') {
      // Prefer the rendered list: card plays carry no queue, so there is often
      // nothing for the site's `ended` handler to advance to.
      if (!clickAdjacentCard(1)) {
        try {
          audio.dispatchEvent(new Event('ended'))
        } catch (error) {
          audio.currentTime = 0
        }
      }
    } else if (cmd === 'prev') {
      if (!clickAdjacentCard(-1)) audio.currentTime = 0
    }
    postState(true)
  }

  if (embedded) {
    applyEmbedChrome()
    window.addEventListener('message', function (event) {
      if (event.source !== parentWindow) return
      command(event.data)
    })
    window.addEventListener('play', function (event) {
      if (event.target && event.target.tagName === 'AUDIO') postState(true)
    }, true)
    window.addEventListener('pause', function (event) {
      if (event.target && event.target.tagName === 'AUDIO') postState(true)
    }, true)
    window.addEventListener('loadedmetadata', function (event) {
      if (event.target && event.target.tagName === 'AUDIO') postState(true)
    }, true)
    window.addEventListener('ended', function (event) {
      if (event.target && event.target.tagName === 'AUDIO') postState(true)
    }, true)
    setInterval(function () {
      postState(false)
    }, 500)
    postState(true)
  }
})()
