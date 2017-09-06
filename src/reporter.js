const bytes = require('bytes')
const { error, warn, info } = require('prettycli')
const { event, repo, branch, commit_message, sha } = require('ci-env')
const build = require('./build')
const api = require('./api')
const debug = require('./debug')
const shortener = require('./shortener')

const setBuildStatus = ({
  url,
  files,
  globalMessage,
  fail,
  currentEvent,
  currentBranch
}) => {
  if (fail) build.fail(globalMessage || 'bundle size > maxSize', url)
  else {
    if (currentEvent === 'push' && currentBranch === 'master') {
      const values = []
      files.map(file => values.push({ path: file.path, size: file.size }))
      api.set(values)
    }
    build.pass(globalMessage || 'Good job! bundle size < maxSize', url)
  }

  debug('global message', globalMessage)
}

const compareFile = (path, obj, master, postfix) => {
  let fail = false
  const {size, maxSize, level} = obj

  const levelStr = level ? `(${level})` : '';

  let message = `${path}: ${postfix}${levelStr} ${bytes(size)} `
  const prettySize = bytes(maxSize)
  /*
    if size > maxSize, fail
    else if size > master, warn + pass
    else yay + pass
  */

  if (size > maxSize) {
    fail = true
    if (prettySize) message += `> maxSize ${prettySize}`
    error(message, { fail: false, label: 'FAIL' })
  } else if (!master) {
    if (prettySize) message += `< maxSize ${prettySize}`
    info('PASS', message)
  } else {
    if (prettySize) message += `< maxSize ${prettySize} `
    const diff = size - master

    if (diff < 0) {
      message += `(${bytes(Math.abs(diff))} smaller than master, good job!)`
      info('PASS', message)
    } else if (diff > 0) {
      message += `(${bytes(diff)} larger than master, careful!)`
      warn(message)
    } else {
      message += '(same as master)'
      info('PASS', message)
    }
  }

  return fail
}

const compare = (files, masterValues = {}) => {
  let globalMessage
  let fail

  files.map(file => {
    const { path, real, zlib, brotli, zopfli, master } = file
    file.master = masterValues[file.path]

    if (real.size !== null) {
      fail = compareFile(path, real, master, 'real') || fail
    }
    fail = compareFile(path, zlib, master, 'zlib')
    if (zopfli.size !== null) {
      fail = compareFile(path, zopfli, master, 'zopfli') || fail
    }
    if (brotli.size !== null) {
      fail = compareFile(path, brotli, master, 'brotli') || fail
    }

    if (files.length === 1) globalMessage = 'FAIL'
  })

  /* prepare the build page */
  const params = encodeURIComponent(
    JSON.stringify({ files, repo, branch, commit_message, sha })
  )
  let url = `https://bundlesize-store.now.sh/build?info=${params}`

  debug('url before shortening', url)

  shortener
    .shorten(url)
    .then(res => {
      url = res.data.id
      debug('url after shortening', url)
      setBuildStatus({ url, files, globalMessage, fail, event, branch })
    })
    .catch(err => {
      debug('err while shortening', err)
      setBuildStatus({ url, files, globalMessage, fail, event, branch })
    })
}

const reporter = files => {
  if (api.enabled) api.get().then(masterValues => compare(files, masterValues))
  else compare(files)
}

module.exports = reporter
