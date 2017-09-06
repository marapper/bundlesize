const fs = require('fs')
const bytes = require('bytes')
const glob = require('glob')
const gzip = require('gzip-size')
const brotli = require('brotli-size')
const zopfli = require('zopfli-size')
const { error } = require('prettycli')
const config = require('./config')
const debug = require('./debug')

const files = []

config.map(file => {
  const paths = glob.sync(file.path)
  if (!paths.length) {
    error(`There is no matching file for ${file.path} in ${process.cwd()}`, {
      silent: true
    })
  } else {
    paths.map(path => {
      const maxSize = bytes(file.threshold || file.maxSize || file.zlib.maxSize) || Infinity

      const content = fs.readFileSync(path, 'utf8')

      const brotliOpts = (file.brotli && file.brotli.level) ? {quality: file.brotli.level} : undefined

      const zlibOpts = (file.level || file.zlib) ? {level: file.level || file.zlib.level} : undefined

      const zopfliOpts = (file.level || file.zopfli) ? {level: file.level || file.zopfli.level} : undefined

      files.push({
        path,
        real: {
          size: file.real ? fs.statSync(path).size : null,
          maxSize: (file.real && file.real.maxSize) ? bytes(file.real.maxSize) : maxSize
        },
        brotli: {
          size: file.brotli ? brotli.sync(content, brotliOpts) : null,
          maxSize: (file.brotli && file.brotli.maxSize) ? bytes(file.brotli.maxSize) : maxSize
        },
        zlib: {
          size: gzip.sync(content, zlibOpts),
          maxSize: maxSize
        },
        zopfli: {
          size: file.zopfli ? zopfli.sync(content, zopfliOpts) : null,
          maxSize: (file.zopfli && file.zopfli.maxSize) ? bytes(file.zopfli.maxSize) : maxSize
        }
      })
    })
  }
})

debug('files', files)

module.exports = files
